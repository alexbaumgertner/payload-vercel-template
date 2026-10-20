#!/usr/bin/env bash
# Applies every committed migration to an EMPTY local database with schema push off and fails on
# any error — the same `payload migrate` the Vercel build runs, minus production. CI job
# `migrations` runs it; locally:
#
#   createdb app_migrations_check
#   DATABASE_URL=postgresql://app:app@127.0.0.1:5432/app_migrations_check bash scripts/check-migrations.sh
#
# Findings behind the checks (Payload 3.90, verified 2026-10-20, see docs/decisions.md):
# - `payload migrate` does not push: the CLI sets PAYLOAD_MIGRATING=true before init, and the
#   Postgres adapter skips the dev push then, whatever PAYLOAD_DB_PUSH says. Push stays off here
#   anyway, so a later Payload change can't quietly mend broken migrations.
# - On a database that was ever pushed (a `batch = -1` row) migrate asks for confirmation and,
#   with no TTY, waits forever — hence the empty-database check and the timeout.
# - The CLI applies the files in src/migrations sorted by name; index.ts is not consulted.
set -euo pipefail

cd "$(dirname "$0")/.."

: "${DATABASE_URL:?set DATABASE_URL to an empty local database}"

host="$(node -e 'console.log(new URL(process.argv[1]).hostname)' "$DATABASE_URL")"
case "$host" in
  localhost | 127.0.0.1 | ::1 | '[::1]' | postgres) ;;
  *)
    echo "check-migrations: refusing non-local database host $host" >&2
    exit 1
    ;;
esac

tables="$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
if [ "$tables" != "0" ]; then
  echo "check-migrations: database is not empty ($tables tables); create a fresh one" >&2
  exit 1
fi

# DATABASE_URI wins over DATABASE_URL (src/lib/database-url.ts): pin both, so an env file can't
# redirect the run to another database.
export DATABASE_URI="$DATABASE_URL"
export PAYLOAD_DB_PUSH=false

timeout 300 pnpm payload migrate </dev/null

expected="$(find src/migrations -maxdepth 1 -name '*.ts' ! -name index.ts -exec basename {} .ts \; | sort)"
applied="$(psql "$DATABASE_URL" -tAc 'SELECT name FROM payload_migrations WHERE batch > 0 ORDER BY name')"
if [ "$expected" != "$applied" ]; then
  echo "check-migrations: applied migrations differ from src/migrations" >&2
  diff <(echo "$expected") <(echo "$applied") >&2 || true
  exit 1
fi
if [ "$(psql "$DATABASE_URL" -tAc 'SELECT count(*) FROM payload_migrations WHERE batch = -1')" != "0" ]; then
  echo "check-migrations: something pushed the schema during the run" >&2
  exit 1
fi

echo "check-migrations: $(echo "$expected" | wc -l | tr -d ' ') migrations applied to an empty database"

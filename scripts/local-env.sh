#!/usr/bin/env bash
# Give this checkout its own databases and dev-server port, so several copies of the repo
# (worktrees, parallel agents) run side by side on one machine. Idempotent.
#
#   bash scripts/local-env.sh <suffix>
#
# Creates `app_<suffix>` + `app_<suffix>_test` and writes .env.development.local
# (DATABASE_URL, PORT, NEXT_PUBLIC_SITE_URL) and .env.test.local (TEST_DATABASE_URL).
# Other lines in those files are kept. Connection uses the standard libpq variables:
# PGHOST (127.0.0.1), PGPORT ($POSTGRES_HOST_PORT or 5432), PGUSER (app) and PGPASSWORD
# (app when PGUSER is unset; otherwise optional — ~/.pgpass works).
# Port: the one already in .env.development.local, else $PORT if free, else the first free from 3001.
set -euo pipefail

cd "$(dirname "$0")/.."

suffix="${1:-}"
if [[ ! "$suffix" =~ ^[a-z0-9_]+$ ]]; then
  echo "usage: bash scripts/local-env.sh <suffix>   (lowercase letters, digits, _)" >&2
  exit 1
fi

if [ -z "${PGUSER:-}" ]; then
  export PGUSER=app
  export PGPASSWORD="${PGPASSWORD:-app}"
fi
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-${POSTGRES_HOST_PORT:-5432}}"

dev_db="app_${suffix}"
test_db="app_${suffix}_test"

for db in "$dev_db" "$test_db"; do
  if [ "$(psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'")" != "1" ]; then
    psql -d postgres -qc "CREATE DATABASE \"$db\""
    echo "local-env: created database $db"
  fi
done

# KEY=value from a dotenv file (last occurrence), empty when absent.
read_key() { [ -f "$2" ] && sed -n "s/^$1=//p" "$2" | tail -n 1 || true; }

# Replace KEY=… in place, or append it; the file is created when missing.
write_key() {
  local key="$1" value="$2" file="$3"
  touch "$file"
  if grep -q "^$key=" "$file"; then
    local tmp
    tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" 'index($0, k "=") == 1 { print k "=" v; next } { print }' "$file" >"$tmp"
    cat "$tmp" >"$file"
    rm -f "$tmp"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}

port_free() { ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

port="$(read_key PORT .env.development.local)"
if [ -z "$port" ] && [ -n "${PORT:-}" ] && port_free "$PORT"; then port="$PORT"; fi
if [ -z "$port" ]; then
  port=3001
  while ! port_free "$port"; do port=$((port + 1)); done
fi

auth="$PGUSER${PGPASSWORD:+:$PGPASSWORD}"
url() { printf 'postgresql://%s@%s:%s/%s' "$auth" "$PGHOST" "$PGPORT" "$1"; }

write_key DATABASE_URL "$(url "$dev_db")" .env.development.local
write_key PORT "$port" .env.development.local
write_key NEXT_PUBLIC_SITE_URL "http://localhost:$port" .env.development.local
write_key TEST_DATABASE_URL "$(url "$test_db")" .env.test.local

echo "local-env: $dev_db + $test_db on $PGHOST:$PGPORT, dev server on http://localhost:$port"
echo "local-env: wrote .env.development.local and .env.test.local (pnpm dev, test:int and test:e2e read them)"

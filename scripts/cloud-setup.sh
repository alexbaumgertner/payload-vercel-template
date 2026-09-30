#!/usr/bin/env bash
# Idempotent setup for Cursor cloud agents and fresh Linux machines:
# local Postgres with dev + test databases, dependencies, and a .env.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql
fi

sudo service postgresql start

sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='app'" | grep -q 1 ||
  sudo -u postgres psql -qc "CREATE USER app WITH PASSWORD 'app' CREATEDB;"
for db in app app_test; do
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 ||
    sudo -u postgres psql -qc "CREATE DATABASE $db OWNER app;"
done

corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s/^PAYLOAD_SECRET=.*/PAYLOAD_SECRET=$(openssl rand -hex 32)/" .env
fi

pnpm exec playwright install --with-deps chromium >/dev/null

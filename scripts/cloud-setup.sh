#!/usr/bin/env bash
# Idempotent setup for cloud agents (Codex cloud, Claude Code on the web, Cursor),
# dev containers and fresh Linux machines: Postgres with dev + test databases,
# dependencies, a .env and Playwright's Chromium. Safe to re-run any time
# (e.g. when an agent finds Postgres stopped).
set -euo pipefail

cd "$(dirname "$0")/.."

# Root in Codex cloud, a sudo user elsewhere; sudo that cannot elevate counts as none.
SUDO=""
if [ "$(id -u)" -ne 0 ] && sudo -n true 2>/dev/null; then SUDO="sudo"; fi

# Postgres with the dev + test databases (also run by the SessionStart hook).
bash scripts/cloud-pg-start.sh

corepack enable >/dev/null 2>&1 || $SUDO corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s/^PAYLOAD_SECRET=.*/PAYLOAD_SECRET=$(openssl rand -hex 32)/" .env
fi

if [ -n "$SUDO" ] || [ "$(id -u)" -eq 0 ]; then
  pnpm exec playwright install --with-deps chromium >/dev/null
else
  pnpm exec playwright install chromium >/dev/null
fi

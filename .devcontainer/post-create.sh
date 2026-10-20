#!/usr/bin/env bash
# Runs once when the dev container is created. Postgres comes from the `db` service,
# so cloud-setup.sh skips its own Postgres install.
set -euo pipefail
sudo chown -R "$(id -u):$(id -g)" ~/.claude ~/.codex 2>/dev/null || true
npm install -g @openai/codex >/dev/null
bash scripts/cloud-setup.sh
echo "Ready: pnpm dev → http://localhost:3000  ·  claude  ·  codex"

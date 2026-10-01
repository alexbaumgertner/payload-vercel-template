---
name: db-migrations
description: How schema changes reach Postgres/Neon in this project (Payload push vs migrations, Vercel build). Use when changing collections or fields, when a deploy fails on migrations, or when the user asks about the database schema.
---

# Database migrations

- **Local dev**: Payload push mode — the dev DB schema follows `payload.config.ts` automatically on `pnpm dev`.
  Do not run `pnpm migrate` against the dev DB; mixing push and migrations makes Payload prompt interactively.
- **Before merge**: `pnpm migrate:create <kebab-name>` generates `src/migrations/<timestamp>_<name>.ts|json` and updates `index.ts`. Commit all three.
  Review the generated SQL: renames show up as drop + add — rewrite as `ALTER ... RENAME` by hand to keep data.
  Making a field `localized` also drops its column: add `INSERT INTO "<slug>_locales" ... SELECT ..., 'en', "id"`
  before the drop (and the reverse in `down`). Example: `src/migrations/20261001_144024_localize_changelog.ts`.
- **Testing a hand-edited migration**: `CREATE DATABASE app_migr OWNER app;`, apply the previous migrations from a
  `git archive HEAD` copy with `DATABASE_URL=…/app_migr pnpm migrate`, seed, then run the new one from the working tree.
- **Production (Vercel + Neon)**: build command `pnpm build:vercel` runs `payload migrate` then `next build`.
  Neon preview branches get their own `DATABASE_URL`, so preview deploys migrate a branch, not prod.
- **Never** run `migrate:fresh` / `migrate:reset` or connect to a `*.neon.tech` URL from the agent (blocked by the shell guard).
- Reset the local dev DB if it gets into a bad state:
  `sudo -u postgres psql -c "DROP DATABASE app;" -c "CREATE DATABASE app OWNER app;" && pnpm seed`

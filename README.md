# payload-vercel-template

Production-ready starter for a solo SaaS: **Next.js 16 + Payload 3 + PostgreSQL (Neon) on Vercel**, with TypeScript, CSS Modules, Zod, Vitest and Playwright — and an AI workflow that works the same in **Cursor** and **Claude Code**.

What's inside out of the box:

- Landing page with a **waitlist** (Server Action + Zod + honeypot, stored in Postgres, private to admins)
- **Changelog** managed in the Payload admin, with scheduled publishing and on-save revalidation
- Payload admin at `/admin` (users, media, waitlist, changelog); media goes to Vercel Blob when configured
- **Passwordless login**: email → 6-digit one-time code (hashed, 10-min TTL, attempt and rate limits, no account enumeration), sent via Resend
- Unit, integration (real Postgres) and e2e (desktop + mobile) tests
- `AGENTS.md`, scoped Cursor rules, skills, a reviewer subagent, safety hooks, Bugbot rules, MCP config

## Versions

| Package                 | Version       | Why this one                                           |
| ----------------------- | ------------- | ------------------------------------------------------ |
| next                    | 16.3.8        | latest 16.x; Payload 3.90 supports `>=16.3.3 <17`      |
| payload + @payloadcms/* | 3.90.2        | latest                                                 |
| react / react-dom       | 19.3.0        | within Payload's `^19.2.1`                             |
| typescript              | 6.0.3         | typescript-eslint supports `<6.1` (TS 7 not yet)       |
| zod                     | 4.6.5         | latest                                                 |
| vitest / vite           | 5.0.3 / 8.3.1 | latest                                                 |
| @playwright/test        | 1.63.0        | latest                                                 |
| eslint                  | 9.39.5        | eslint-config-next plugins don't support ESLint 10 yet |
| graphql                 | 16.14.2       | Payload peer `^16.8.1`                                 |

## Quick start

Requirements: Node 22.12+, pnpm 10, PostgreSQL 15+ (local install or `docker compose up -d`).

Click **Use this template** on GitHub (or `gh repo create my-app --template alexbaumgertner/payload-vercel-template --private --clone`), then rename the product in `package.json` and `src/config/site.ts`.

```bash
pnpm install
cp .env.example .env               # set PAYLOAD_SECRET: openssl rand -hex 32
# create databases (skip if you use docker compose):
createdb app && createdb app_test  # or: bash scripts/cloud-setup.sh on Ubuntu
pnpm seed                          # demo changelog + user admin@example.com
pnpm dev                           # http://localhost:43127  ·  admin: /admin
```

**Signing in:** open `/admin`, enter `admin@example.com`, click "Send login code". Without `RESEND_API_KEY` the code is printed in the `pnpm dev` terminal:

```
[auth] RESEND_API_KEY not set — login code for admin@example.com: 381904
```

Add more users with `pnpm create-admin you@example.com` (there is no sign-up screen). Codes are valid for 10 minutes, work once and burn after 5 wrong attempts; each email can request 3 codes per 15 minutes and each IP 20 per hour.

## Scripts

| Command                      | What it does                                                                |
| ---------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`                   | Dev server on port 43127 (Turbopack)                                        |
| `pnpm check`                 | typecheck + lint + unit tests — the "am I done?" command                    |
| `pnpm test:browser`          | Vitest Browser Mode: client components in real Chromium (via Playwright)    |
| `pnpm test:browser:watch`    | Same, headed, re-runs on save — inspect the iframe with DevTools            |
| `pnpm test:int`              | Vitest against the `app_test` Postgres database                             |
| `pnpm test:e2e`              | Playwright, desktop + mobile (`pnpm exec playwright install chromium` once) |
| `pnpm generate:types`        | Regenerate `src/payload-types.ts` after schema changes                      |
| `pnpm migrate:create <name>` | Create a migration before merging schema changes                            |
| `pnpm seed`                  | Idempotent demo data                                                        |
| `pnpm create-admin <email>`  | Add a user who can sign in with an email code                               |

## Testing layers

| Layer             | Runs in                                | Use it for                                                                |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| `tests/unit`      | Vitest + jsdom                         | Zod schemas, pure helpers, OTP/session logic                              |
| `tests/browser`   | Vitest Browser Mode, Chromium over CDP | Client components: real focus, typing, pending/error states               |
| `tests/int`       | Vitest + Node + Postgres               | Services, access control, auth strategy via the Payload Local API         |
| `tests/e2e`       | Playwright, desktop + Pixel 7          | Full user flows; `devtools.e2e.spec.ts` adds CDP throttling, CLS, console |
| `chrome-devtools` | MCP server for the agent               | Interactive debugging: console, network, performance traces, Lighthouse   |

Debugging: `pnpm test:browser:watch` opens Chromium with the component in an iframe (DevTools work as usual); `pnpm test:e2e --ui` or `--debug` gives Playwright's time-travel UI, and `trace: 'on-first-retry'` saves traces on CI.

## Deploy (Vercel + Neon)

1. Import the repo in Vercel. `vercel.json` sets the build to `pnpm build:vercel` (runs `payload migrate`, then `next build`).
2. Add the **Neon** integration from the Vercel Marketplace (gives `DATABASE_URL`, with a DB branch per preview) — use the pooled URL.
3. Add **Vercel Blob** storage (gives `BLOB_READ_WRITE_TOKEN`) so media uploads persist.
4. Set `PAYLOAD_SECRET` and `NEXT_PUBLIC_SITE_URL`.
5. Add **Resend** (Vercel Marketplace or resend.com): set `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS` on a verified domain. In production, login fails loudly without them instead of pretending the code was sent.
6. Create the first user against the production database once, from your machine:
   `DATABASE_URL=<neon-url> pnpm create-admin you@example.com` — then sign in at `/admin` with the emailed code.

Schema workflow: local dev uses Payload push (auto-sync); before merging a collection change run `pnpm migrate:create <name>` and commit `src/migrations/*`.

## AI workflow

The same files drive Cursor and Claude Code:

| File                                           | Cursor                                                                            | Claude Code                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------- |
| `AGENTS.md`                                    | always-on project context                                                         | via `CLAUDE.md` → `@AGENTS.md`         |
| `.cursor/rules/*.mdc`                          | scoped rules by glob (collections, actions, UI, tests)                            | —                                      |
| `.claude/skills/*`                             | `/feature`, `/ship`, `/new-collection`, auto `db-migrations`, `payload` reference | same                                   |
| `.claude/agents/reviewer.md`                   | `/reviewer` subagent (read-only)                                                  | same                                   |
| `.cursor/hooks.json` / `.claude/settings.json` | prettier on edit, shell guard, typecheck before finishing                         | same scripts in `scripts/agent-hooks/` |
| `.cursor/mcp.json` / `.mcp.json`               | Context7, Neon, Vercel, Chrome DevTools (+ Playwright for Claude Code)            |                                        |
| `.cursor/worktrees.json`                       | `/worktree` and `/best-of-n` get deps + `.env` automatically                      |                                        |
| `.cursor/environment.json`                     | Cloud Agents: Postgres + deps via `scripts/cloud-setup.sh`                        |                                        |
| `.cursor/BUGBOT.md`                            | PR review rules                                                                   |                                        |

The shell guard (`scripts/agent-hooks/guard-shell.mjs`) blocks force pushes, destructive SQL, `migrate:fresh/reset`, connections to `*.neon.tech` and production Vercel commands.
If you enable "third-party configs" in Cursor, it also loads `.claude/settings.json`; the scripts are idempotent and the typecheck hook skips its duplicate run.

Daily loop: `/feature <idea>` → agent writes `docs/stories/NNN-*.md` → you approve → failing tests per acceptance criterion → implementation → hooks format and typecheck → browser check (Chrome DevTools MCP) → `/reviewer` → `/ship`.
Fill in `docs/product.md` — agents build better features when they know who they're for.

@AGENTS.md

# Claude Code notes

AGENTS.md (imported above) is the shared source of truth for Cursor, Claude Code and Copilot — put stack, rules and
workflow changes there. Folder rules live in nested `AGENTS.md` files; each has a sibling `CLAUDE.md` that imports it,
so Claude Code loads them when working in that folder. This file only adds what helps when working with Claude Code.

## How a request flows

- **Public page:** `src/proxy.ts` (locale from `NEXT_LOCALE` cookie → `Accept-Language`; `/` is served from `/en`)
  → `[locale]/layout.tsx` → `[locale]/(site)/<page>.tsx` (Server Component) → `features/<name>/queries.ts`
  → `getPayloadClient()` (`src/lib/payload.ts`) → Payload Local API with `overrideAccess: false`, `locale`, `fallbackLocale`.
- **Mutation:** client component → `features/<name>/actions.ts` (`monitorAction` → Zod `safeParse` → `service.ts`
  → `track()` only after success) → returns `{ status, error?: code }`; the component translates the code via `messages/*`.
- **Admin:** `(payload)/` is generated. Custom pieces are wired in `src/payload.config.ts` (`beforeLogin` =
  `EmailCodeLogin`, logout = `LogoutButton`); `next.config.ts` applies `security-headers.ts` and, only with
  `SENTRY_DSN`, `withSentryConfig`.
- **Content revalidation:** collection `afterChange`/`afterDelete` hooks (see `ChangelogEntries.ts`) loop over
  `locales` and revalidate `/${locale}` paths, skipping when `req.context.disableRevalidate` is set (scripts, tests).

## Running a single test

```bash
pnpm vitest run --project unit tests/unit/otp.unit.spec.ts
pnpm vitest run --project int tests/int/waitlist.int.spec.ts -t "duplicate"
pnpm test:e2e tests/e2e/landing.e2e.spec.ts --project desktop
```

- `int` needs local Postgres (`docker compose up -d` creates `app` + `app_test`); `tests/helpers/int-setup.ts` forces
  `DATABASE_URL` to `TEST_DATABASE_URL` / `app_test`. Files run serially (`fileParallelism: false`).
- `e2e` reuses a dev server already on :3000 (else starts one). Workers run with `PAYLOAD_DB_PUSH=false`; only the
  dev server pushes schema. Log in with `tests/helpers/login.ts` (`issueKnownCode` → code `424242`), seed with
  `seedUser.ts` / `seedChangelog.ts`.
- `unit`/`browser` alias `server-only` to an empty module; `browser` also stubs `@/lib/payload` — `vi.mock` the action.

## Claude Code harness in this repo (`.claude/settings.json`)

- **Hooks:** `PreToolUse` Bash → `guard-shell.mjs`; `mcp__.*` → `guard-mcp.mjs` (allow-list in
  `scripts/agent-hooks/policy.mjs`); `PostToolUse` edits → prettier; `Stop` → `pnpm typecheck` if TS files changed,
  and blocks finishing until it passes. A blocked command is intentional — ask the human, don't rephrase around it.
- **Denied:** reading `.env` / `.env.*` (use `.env.example` and `src/lib/env.ts`), Neon/Vercel write and secret tools.
- **Skills:** `/feature` (story → approval → failing tests → code), `/new-collection`, `/ship` (check, types,
  migration reminder, commit, push); auto-loaded `payload` and `db-migrations`. Subagent: `reviewer` (read-only).
- Changing guard rules means updating `tests/unit/agent-guards.unit.spec.ts`.

## Gotchas

- Edits to `next.config.ts` or `src/lib/security-headers.ts` need a dev-server restart (not hot-reloaded).
- `src/lib/env.ts` parses at import time: a missing `DATABASE_URL`/`PAYLOAD_SECRET` throws in any script or test.
- Optional integrations are off when their env var is unset: Resend (codes print to the console), Vercel Blob
  (local media), Sentry (`SENTRY_DSN`), analytics (`ANALYTICS_PROVIDER=none`). Keep them no-ops when unset — e2e checks it.
- Keep `<Suspense>`/`loading.tsx` out of `[locale]/` itself: next to `[...rest]` it turns 404s into 200s.
- CSP is report-only but e2e fails on any violation; new third-party origins go into `security-headers.ts`.
- Don't reintroduce eval: `instrumentation-client.ts` sets `z.config({ jitless: true })` and an e2e spies on `Function`.
- Accepted/known limits and their reasons are in `docs/decisions.md` — check there before "fixing" them.

# Decisions

Short log of choices that shape the codebase. Newest first. One entry = what we chose, why, and what would make us revisit it.

## 2026-10-20 — Blob media: `preview/` prefix, same `media` columns everywhere

**Context.** Preview and production deployments share one Vercel Blob store (the token is issued to both), but every
preview has its own Neon branch. Ids and file names drift apart, so a preview upload can write to a production path
and replace the file; Blob overwrites and deletes are permanent. Separately, `@payloadcms/storage-vercel-blob` adds
`prefix` and `_objectKey` fields to `media` only when the plugin is enabled (token set). Migrations are generated
locally without a token, so they never created those columns — production with a Blob token would query columns that
don't exist.

**Decision.** The plugin's own per-collection `prefix` option, set by `src/lib/blob-prefix.ts`: `<VERCEL_ENV>/` for
every non-production Vercel environment (`preview/`, and `development/` for `vercel dev`), none for production (stored
URLs keep resolving) and none locally (files go to `./media`). Reads and deletes use the `prefix` stored on each row.
`alwaysInsertFields: true` keeps the `media` schema identical with and without a token; migration
`20261020_095132_media_blob_fields` adds `prefix` (default `''`) and `_objectkey`. Pattern from sync-trainer
(`artifact-path.ts`); there it was a hand-built path, here the plugin does it.

**Consequences.** Preview uploads accumulate under `preview/` and are never cleaned up automatically — delete the
folder from the Blob store now and then. Rows a preview inherits from production keep `prefix = ''` and still show
the production files; deleting such a row on a preview would delete the production file, so don't.
Revisit if: previews get their own Blob store, or Payload v4 makes `alwaysInsertFields` the default.

## 2026-10-20 — Local tooling refuses remote databases; push is local-only

**Context.** Push and the scripts used whatever `DATABASE_URL` the process saw. One `vercel env pull` (which writes
production secrets into `.env*.local`) followed by `pnpm dev` would push the dev schema into Neon production — push
drops columns it doesn't know. `pnpm seed` would write a demo admin into production. The decision on MCP guards
already noted "a production `DATABASE_URL` in your local `.env` would be used by `pnpm seed` and the dev server".

**Decision.** `src/lib/database-target.ts` (from hht-research-platform, plus murad-portal's seed guard), with the
resolved URL:

- Push only when requested **and** the host is local (`localhost`, `127.0.0.1`, `::1`, `postgres`,
  `host.docker.internal`) **and** `NODE_ENV !== 'production'`. No remote-push opt-in (HHT had one for deploy builds;
  here production changes through migrations only).
- `payload.config.ts` refuses a remote database outside Vercel (`VERCEL`/`VERCEL_ENV` unset) unless
  `ALLOW_REMOTE_DATABASE=1`. `NODE_ENV=production` alone does not exempt: orchestrators export it globally.
- `create-admin` (and `backup:restore`) need `ALLOW_REMOTE_DATABASE=1` for a remote target, even on Vercel. The one
  deliberate production use is in `docs/runbooks/production-admin.md`.
- `seed` runs only on a Vercel Preview build or against a local database; no override.
- The shell guard blocks commands that set `ALLOW_REMOTE_DATABASE=1`: it is a human's switch.
- `seed` / `create-admin` now load `.env.development.local` before `.env`, like `next dev`, so they use the
  checkout's database (`scripts/local-env.sh`).

**Consequences.** Self-hosting outside Vercel needs `ALLOW_REMOTE_DATABASE=1` in the runtime env (documented in the
guard's error). A typo'd local host name (e.g. a custom docker service) is treated as remote — add it to
`LOCAL_HOSTS`. The guard runs when the Payload config loads, i.e. on the dev server's first Payload request, not on
`next dev` boot.
Revisit if: the template moves off Vercel, or a remote dev database becomes a normal setup.

## 2026-10-20 — Connection string: explicit precedence, logged, `verify-full`

**Context.** On Vercel the Neon integration puts a per-preview branch into `DATABASE_URL`, while `POSTGRES_URL` can
still point at production. Code that read `POSTGRES_URL` first would make a preview write into production with no
error. Neon's strings carry `sslmode=require`, which `pg` treats as `verify-full` today but will downgrade to libpq
semantics (no certificate check) in its next major. An env file line `KEY=` produced an empty string, which failed
validation (`z.url()`) or overrode a default instead of meaning "unset".

**Decision.** `src/lib/database-url.ts` picks `DATABASE_URI` (hand-set) → `DATABASE_URL` → `POSTGRES_URL`, upgrades
`require|prefer|verify-ca` to `verify-full` (URLs without `sslmode` — local Postgres — are untouched), and logs once
per process `[db] using <SOURCE>: <host>/<db> · fingerprint <sha256(host)[:8]>` — never credentials. Vercel redacts
hosts that look like secrets; the fingerprint survives, so production and preview logs can be compared. `env.ts`
resolves `DATABASE_URL` through it (the rest of the code reads only `env.DATABASE_URL`) and drops empty values
before validation. `int-setup.ts` deletes `DATABASE_URI` / `POSTGRES_URL` so they can't beat the test database.
Ported from sync-trainer (selection, TLS) and murad-portal (`KEY=` fix).

**Consequences.** A `DATABASE_URI` in a local env file wins over `DATABASE_URL` — the startup log line shows which.
Revisit if `pg` changes `sslmode` semantics again or Neon's integration changes variable names.

## 2026-10-20 — Agent file access: local env files yes, production env and `.vercel/` no

**Context.** `CLAUDE.md` said reading `.env` / `.env.*` was denied, but the `deny` list in `.claude/settings.json` was
commented out, so nothing was denied. Parallel checkouts now keep their database URLs and port in
`.env.development.local` / `.env.test.local`, which agents need to create and fix.

**Decision.** Allow Read/Edit/Write of `.env.development.local` and `.env.test.local`; deny Read/Edit/Write of
`.env.production*` and `.vercel/**` (where `vercel pull` writes production settings and secrets). `.env` stays
unlisted, so Claude Code asks. The shell guard blocks `vercel pull` / `vercel env pull`, pushes to `main`, and
rolls back migrations only on a local scratch database named in the same command segment (a second segment
cannot ride along). Settings, `CLAUDE.md` and `AGENTS.md` state the same rule; a unit test pins the settings.

**Consequences.** Local secrets (`PAYLOAD_SECRET`, optional API keys) in the `.local` files are readable by agents —
keep production values out of them. Codex has no file-permission layer; `AGENTS.md` states the rule.
Revisit if production secrets ever need to live in a local file, or Claude Code changes its path-rule syntax.

## 2026-10-20 — Multi-agent workflow: one story, one branch, one PR

**Context.** Products from the template are built by several agents (Claude Code, Codex, Cursor, a home-server
orchestrator running unattended sessions) plus the founder. Without shared rules they collide on migrations, guess
at ambiguous stories, and open PRs too large to review.

**Decision.** `AGENTS.md` (read by every agent) carries the rules: approved stories only; one story = one branch
= one PR (agent-named branch, or the orchestrator's `agent/<task-id>`); ambiguity → conservative choice plus
questions in the PR; schema/access stories sequential, UI-only in parallel; PRs under ~400 lines; P0/P1-only review
rules. `.github/pull_request_template.md` and `docs/prompts/` give every agent the same PR shape and prompts.
`next dev` writes a `nextjs-agent-rules` block into `AGENTS.md`; it is committed so the tree stays clean.

**Consequences.** Review time goes to access control and migrations, not style. Unattended runs never block on a
question; the human answers in the PR.
Revisit if: two agents regularly need the same files at once, or review rules miss a class of incident.

## 2026-10-20 — Codex parity: `pnpm check` on Stop, guards by hand

**Context.** Codex does not read `CLAUDE.md` or `.claude/settings.json`, so a Codex session had no quality gate and
no guards. Codex now supports `<repo>/.codex/hooks.json` (same event names as Claude Code; Stop accepts JSON or
nothing on stdout, exit 2 + stderr continues the turn).

**Decision.** `.codex/hooks.json` runs `scripts/agent-hooks/stop-check.mjs` on Stop: `pnpm check`, output on stderr,
exit 2 on failure, one retry (`stop_hook_active`) so a session cannot loop forever. Shell/MCP guards are not ported:
`AGENTS.md` (which Codex reads) states that they do not run there and the rules apply by hand.

**Consequences.** Project hooks load only after the user trusts `.codex/` and approves the hook in `/hooks`. Whether
hooks run in Codex cloud is undocumented — assume they do not.
Revisit if Codex documents PreToolUse/shell hooks that could reuse `policy.mjs`.

## 2026-10-20 — Dev environments: dev container, cloud bootstrap, parallel checkouts

**Context.** Products from the template are built by several agents at once (cloud agents, a home-server
orchestrator with one worktree per task) next to the founder's own checkout. The template assumed one checkout per
machine: port 3000, databases `app` / `app_test`, Postgres on 5432, and a cloud setup that needed working sudo.

**Decision.** (1) `.devcontainer/` with Postgres 18 as a compose service sharing the app's network namespace, so
`.env.example` works unchanged; agent logins in named volumes shared by all projects. (2) `scripts/cloud-pg-start.sh`
is the fast, idempotent "make sure Postgres is up" step (SessionStart hook in Claude Code on the web, Cursor
`start`); it leaves an external Postgres alone and never fails just because sudo cannot elevate. (3) Each checkout
can get its own databases and port via `scripts/local-env.sh`, written to `.env.development.local` /
`.env.test.local`, which `pnpm dev` (`scripts/dev.mjs` — Next reads `PORT` only from the shell), Playwright and the
`int` setup read first. Docker Postgres moves with `POSTGRES_HOST_PORT`.

**Consequences.** `pnpm dev` goes through a 20-line wrapper. Without the `.local` files everything behaves as before
(port 3000, `app` / `app_test`). The dev container has not been built in CI.
Revisit if Next starts reading `PORT` from `.env` files, or if parallel agents move to throwaway cloud databases.

## 2026-10-01 — Agent rules as nested AGENTS.md; Node 24 and Postgres 18 everywhere

**Rules.** Cursor-only `.cursor/rules/*.mdc` became nested `AGENTS.md` files (`src/collections`, `src/features`,
`src/components`, `src/app/(frontend)`, `tests`), which Cursor and GitHub Copilot read natively. Claude Code reads
nested `CLAUDE.md`, so each folder has a one-line `CLAUDE.md` importing its `AGENTS.md`. The root `AGENTS.md` lists
them, because nested-file loading is unreliable in some clients. `.mcp.json` is the only MCP config; Cursor reading it is unverified — if its MCP list is
empty, symlink `.cursor/mcp.json` → `../.mcp.json`. Bugbot rules were dropped; the `reviewer` subagent covers review.

**Versions.** Node `24.x` (Vercel's newest and default runtime; Node 20 is deprecated there on 2026-10-01) is pinned in
`.nvmrc` and `engines`, so CI, local dev and Vercel run the same major. Postgres 18 (GA on Neon and its default for
new projects since June 2026) in CI and `docker-compose.yml`. Existing Neon projects keep the major they were created
with — check it before relying on 18-only features.
Revisit when Vercel adds the next Node LTS.

## 2026-10-01 — Backups: rely on Neon instant restore, document the Blob gap, drill quarterly

**Context.** The template had no restore procedure. Neon keeps a plan-dependent history window; Vercel Blob has no
native backup and deletes are permanent.

**Options.** (a) Ship a `pg_dump` + Blob-copy cron job in the template. (b) Document Neon's built-in restore, a
non-destructive drill and the Blob gap; leave extra backup jobs to products that need them. (c) Nothing.

**Decision.** (b): `docs/runbooks/backup-restore.md`, documentation only. Option (a) adds an S3 bucket, credentials and
a cron that every product would have to pay for and monitor, while most early products only store marketing images.
The drill branches from a past point instead of restoring production, so practising never destroys data. Every
plan-dependent number is marked `[verify in dashboard]` rather than guessed.

**Consequences.** Recovery point for Postgres = anywhere inside the history window; for Blob media = none (re-upload
originals). Baseline stays `partial` until a product adds an off-platform copy (pg_dump to S3, Blob cron copy) and
the drill has been run once with real timings.
Revisit if: users upload files, or compliance requires backups outside Neon/Vercel.

## 2026-10-01 — i18n: next-intl for the public site, English unprefixed, Payload localization for content

**Context.** Products from the template launch in English and Russian. The public site needs localized URLs, copy,
metadata and changelog content; the Payload admin is used by the founder only.

**Compatibility.** `next-intl@4.14.8` peers: `next ^12 || … || ^16`, `react ^16.8 || … || ^19` — fine with
Next 16.3.8 / React 19.3. Pinned exactly. It reads the locale through `next/root-params` (Next 16), so pages stay
statically prerendered per locale (`/en`, `/ru`, `/en/changelog`, `/ru/changelog` are SSG in `next build`).

**Options.** URL prefix `always` (`/en/...`) vs `as-needed` (default locale unprefixed) vs domains; message format
in the action vs error codes; localizing the admin vs not.

**Decision.**

- `localePrefix: 'as-needed'`: existing English URLs (`/`, `/changelog`) keep working and keep their SEO; `/en/*`
  redirects to the unprefixed URL so there is one canonical URL per page. `/ru/*` for Russian.
- `src/proxy.ts` negotiates the locale from the `NEXT_LOCALE` cookie (session cookie, `SameSite=Lax`, set when the
  visitor switches language) and then `Accept-Language`; unsupported languages get English. The matcher skips
  `/admin`, `/api`, `/monitoring` (Sentry tunnel), `/_next`, `/_vercel` and files with an extension.
- Every page sets `<html lang>`, a self-referencing canonical and `hreflang` alternates for each locale plus
  `x-default` → English. `NEXT_PUBLIC_SITE_URL` makes them absolute.
- Server actions return error **codes** (`invalid_email`, `invalid_request`, `server`); components translate them.
  Copy lives in `messages/<locale>.json`; a unit test enforces identical keys, no empty strings and matching rich-text
  tags across locales.
- Admin stays English and is outside locale routing (`/ru/admin` is a 404). Changelog `title`, `summary` and `body` are
  Payload `localized` fields with `fallback: true`; date, tag and scheduling are shared. Untranslated entries show in
  English on `/ru` rather than disappearing.
- Pages live in `[locale]/(site)/` while `not-found.tsx` sits in `[locale]/`: a `loading.tsx` at the same level as the
  catch-all `[...rest]` would start streaming and turn unknown pages into HTTP 200 instead of 404.
- Revalidation hooks call `revalidatePath` on concrete internal paths (`/en`, `/ru/changelog` …). Found in a production
  build: prerendered pages are tagged with their route groups (`/(frontend)/[locale]/(site)/page`), so
  `revalidatePath('/[locale]', 'page')` silently matched nothing. Plain paths match the per-page pathname tag.

**Migration.** Localizing existing fields moves them into `changelog_locales`; Payload's generated migration dropped
the columns without copying. `20261001_144024_localize_changelog` was edited to copy every row into `_locale = 'en'`
first, and `down` copies English (or any translation) back. Tested on a scratch database: old migrations + seed →
new `up` (4/4 rows kept) → `down` (English restored, Russian dropped as documented) → `up` again.

**Consequences.** Adding a language = `locales.ts` + a messages file + a migration (Payload's `_locales` enum).
Locale detection means `/` can redirect a Russian browser to `/ru` — crawlers without `Accept-Language` get English.
The Russian header needed shorter labels at 320–360px; an e2e test guards it. Admin UI translation (Payload's own
`i18n`) and per-locale slugs are not done.
Revisit if: a product needs localized slugs, a third locale with a different script/direction, or translated emails
(the login email is English only).

## 2026-10-01 — Product analytics: typed server-side events, off by default, DNT/GPC respected

**Context.** Products built from the template need funnel numbers (waitlist → login) without each one reinventing
event names or leaking emails into an analytics vendor. Some products will want no analytics at all.

**Compatibility.** `@vercel/analytics@2.0.1` peers: `next >= 13`, `react ^18 || ^19` — fine with Next 16.3.8 /
React 19.3. Pinned exactly.

**Options for consent.** (a) Cookie/consent banner — a UI and legal decision per product, out of scope for the
template. (b) Treat the env flag as the operator's opt-in and the browser's Do Not Track / Global Privacy Control as
the visitor's opt-out. (c) Always on.

**Decision.** (b), with the safest defaults:

- `src/lib/analytics.ts`: `track(event, props, headers)` with a typed catalog (`waitlist_joined {source}`,
  `login_code_requested {resend}`, `login_succeeded {}`). Props are Zod `strictObject`s validated at runtime; unknown
  keys, values over 64 chars or anything containing `@` drop the event with a warning. No user ids, no emails.
- `ANALYTICS_PROVIDER=none` (default) is a real no-op: the adapter is never imported and request headers are never
  read. `vercel` sends server-side custom events through `@vercel/analytics/server` (only `user-agent`, IP and the
  referer without its query string are forwarded) and renders `<PageViews />` (Vercel Web Analytics, cookieless) in the
  public layout only — not in the Payload admin.
- `DNT: 1` / `Sec-GPC: 1` request headers ⇒ no server events; `navigator.doNotTrack` / `globalPrivacyControl` ⇒ the
  page-view `beforeSend` drops the event (the script itself still loads, but sends nothing). Page-view URLs lose their
  query string and fragment.
- `track()` never throws and runs only after the user-visible work succeeded: an analytics outage can't break signup
  or login (tested). It is awaited, so an enabled provider adds one network round-trip to the action; move it into
  `after()` if that latency matters.
- Events fire only on real outcomes: `waitlist_joined` only when a row was created (not for duplicates, bots or
  failures), `login_succeeded` only after the session cookie is set.

**Consequences.** Vercel custom events need a plan that includes them `[verify in dashboard]`; page views work on all
plans with Web Analytics enabled. The DNT/GPC opt-out is not a substitute for a consent banner where the law requires
opt-in — a product that needs one should gate `ANALYTICS_PROVIDER` on stored consent. Adding a provider = one adapter
function in `analytics.ts`; adding an event = one catalog entry (TypeScript then enforces its props at every call site).
Dev CSP allows `https://va.vercel-scripts.com` (the dev debug script); production loads the tracker same-origin.

## 2026-10-01 — Sentry for errors only, off unless `SENTRY_DSN` is set

**Context.** Errors were only visible in Vercel logs, and caught errors (waitlist DB failure, mail provider failure)
only reached `console.error`. The template must work for products that don't want a monitoring vendor.

**Compatibility.** `@sentry/nextjs@11.2.0` declares `next: ^14 || ^15 || ^16`; verified with Next 16.3.8 /
React 19.3 / Turbopack: dev, `next build` with a DSN, and a production run. Pinned exactly, like the rest of the stack.

**Options.** (a) Sentry wizard defaults (always-on SDK, tracing, replay). (b) Errors only, gated by the DSN, privacy
settings locked down. (c) Vercel logs only.

**Decision.** (b).

- One variable, `SENTRY_DSN`. Unset ⇒ `next.config.ts` skips `withSentryConfig` (no build plugin, no tunnel route, no
  source maps), `instrumentation.ts` never imports the SDK, and the client only imports it when the build-time inlined
  `NEXT_PUBLIC_SENTRY_DSN` is non-empty. e2e (`monitoring.e2e.spec.ts`) asserts no SDK global, no Sentry requests and no
  `/monitoring` route.
- Coverage: `onRequestError` (uncaught errors in Server Components, Route Handlers, Server Actions), `monitorAction()`
  around every Server Action, `captureServerError()` for errors we catch and turn into friendly messages, and the
  `error.tsx` / `global-error.tsx` boundaries on the client.
- Privacy (`src/lib/monitoring/options.ts`): `dataCollection` disables user info, cookies, request/response bodies,
  query strings, DB query data and stack-frame locals; `beforeSend` keeps only `user.id`, a header allow-list and the
  URL path, redacts email addresses anywhere in the event, and drops console breadcrumbs (the dev mail fallback prints
  login codes). Server Actions are wrapped with `recordResponse: false` and no `formData`. Structured logs are dropped.
- No tracing, no Session Replay — both add cost and personal data; opt in per product.
- Events go through the same-origin `/monitoring` tunnel, so CSP `connect-src 'self'` needs no Sentry host and ad
  blockers don't drop errors. Cost: one extra function invocation per event.

**Release and source maps on Vercel.**

1. Create a Sentry project (platform: Next.js), copy the DSN into the Vercel project env as `SENTRY_DSN`
   (Production + Preview; leave Development empty so local dev stays quiet).
2. Create an organization auth token (Settings → Developer Settings → Organization Tokens) and add `SENTRY_AUTH_TOKEN`,
   `SENTRY_ORG`, `SENTRY_PROJECT` to the Vercel env. They are only read during `next build`.
3. Releases: the SDK uses `SENTRY_RELEASE` or Vercel's `VERCEL_GIT_COMMIT_SHA` (server) and the build plugin injects
   the same release into the client bundle; environment = `SENTRY_ENVIRONMENT` or `VERCEL_ENV`.
4. Source maps are uploaded during the build and then deleted from the output, so they are never publicly served. Without
   the auth token the build skips the upload and stack traces stay minified.
5. Alternatively install the Sentry integration from the Vercel Marketplace, which provisions the DSN and token.

**Consequences.** Third-party failures are visible without reading logs. The scrubbing can't know every place a product
puts personal data — new features that throw errors containing user input should keep it out of error messages.
Revisit if: we need performance tracing, or move to another vendor (swap `src/lib/monitoring/*` only).

## 2026-10-01 — Security headers: CSP report-only first, everything else enforced

**Context.** The app shipped with Next.js defaults only. A strict CSP can silently break the Payload admin (inline
scripts/styles, Lexical, image previews from Blob), and there is no CSP reporting endpoint yet.

**Options.** (a) Enforce a nonce-based CSP now — needs `proxy.ts` per request and makes every page dynamic. (b) Ship
the full policy as `Content-Security-Policy-Report-Only` and enforce only what is safe. (c) Skip CSP.

**Decision.** (b). Headers live in `src/lib/security-headers.ts` and are applied to every route in `next.config.ts`:

- `Content-Security-Policy-Report-Only` — the target policy (`'self'` + `'unsafe-inline'` for Next/Payload inline
  bootstrap, Blob and Gravatar images, no `unsafe-eval`/`ws:` in production).
- `Content-Security-Policy: frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN` — browsers ignore
  `frame-ancestors` in report-only, so clickjacking protection is enforced separately. Payload's live preview still works
  (same origin).
- `Strict-Transport-Security: max-age=63072000; includeSubDomains` — **no `preload`**: preloading is effectively
  irreversible and must be a per-product choice.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a deny-all
  `Permissions-Policy`, and `poweredByHeader: false`.

e2e (`tests/e2e/security.e2e.spec.ts`) asserts the headers and fails on any `securitypolicyviolation` event on the
public pages, the login page and the signed-in admin with the rich-text editor — so the report-only policy is already
known to be clean for the template.

Dev mode needs `'unsafe-eval'`, so the dev-server e2e can't see eval in production code. A production build was
checked by hand and showed Zod 4's `new Function('')` capability probe; `instrumentation-client.ts` sets
`z.config({ jitless: true })`, and an e2e test spies on the `Function` constructor to keep it that way.

**Consequences.** XSS is not yet mitigated by CSP. To enforce: rename the header to `Content-Security-Policy` once the
product's own third parties (analytics, Sentry, embeds) are added to the policy and the e2e check passes; consider
nonces to drop `'unsafe-inline'` from `script-src`. Changes to `security-headers.ts` need a dev-server restart
(`next.config.ts` imports are not hot-reloaded).

**Found while closing test gaps (same change):**

- **Open redirect after login** — `?redirect=/\evil.example` and `/\t/evil.example` passed the old `startsWith('/')`
  check and browsers treat them as `//evil.example`. `safeRedirect()` now resolves the value against a probe origin and
  falls back to `/admin` on any origin change.
- **Waitlist double submit** — two concurrent submits of one email both passed the "already listed?" check and one hit
  the unique index, showing the user an error. The service now re-checks after a failed insert and returns the same
  success.
- **Accepted risk: concurrent `verifyCode`** — two requests carrying the same correct code at the same instant can both
  sign in, because consuming the code is a read-then-update, not an atomic conditional update. Impact is low (both
  sessions belong to the code's owner, who had the code); revisit with `UPDATE … WHERE usedAt IS NULL RETURNING` if
  codes ever grant more than a session.
- **`PAYLOAD_DB_PUSH`** — every process that opens a Payload connection runs the dev schema push. Playwright workers
  (which seed data) raced the dev server and could block on drizzle's interactive prompt, hanging e2e. The env flag
  (default `true`) lets `playwright.config.ts` disable push in workers while the dev server keeps it.

## 2026-10-01 — Agents never touch production data through MCP

**Context.** The shell guard (`scripts/agent-hooks/guard-shell.mjs`) only sees terminal commands. The Neon and Vercel MCP
servers are called directly by the agent, so they bypassed it: Neon's `run_sql` could query (or, without read-only
mode, write) the production branch, `get_connection_string` / Vercel `get_project_env` hand out production credentials,
and Vercel exposes `deploy_to_vercel`, `request_promote`, env editing and purchases. Neither server knows which Neon
branch is "production" for us, and the Vercel MCP has no read-only mode.

**Options.** (a) Remove both servers. (b) Server-side read-only only (`?readonly=true` on Neon — still allows `SELECT`
on production; nothing equivalent on Vercel). (c) Read-only where available **plus** a pre-call hook with an allow-list,
**plus** static deny rules where the client supports them.

**Decision: (c), layered.**

1. `.mcp.json` uses `https://mcp.neon.tech/mcp?readonly=true`: Neon removes write tools and
   connection strings server-side, regardless of our hooks.
2. `scripts/agent-hooks/policy.mjs` (+ `guard-mcp.mjs`) runs before every MCP call — Cursor `beforeMCPExecution`
   (`failClosed: true`), Claude Code `PreToolUse` matcher `mcp__.*`. It is an **allow-list**: Neon/Vercel metadata and
   docs (`list_*`, `get_*`, `describe_*`, `search*`) pass; anything else — including tools added to the servers later —
   is denied. Neon tools that read a database (`run_sql`, `describe_table_schema`, `explain_sql_statement`, …) are
   allowed **only** with an explicit `branchId` listed in `NEON_AGENT_BRANCH_IDS` (comma-separated, set in the agent's
   environment, not in `.env`). No `branchId` = the default branch = production = denied.
3. Static deny rules that work even if hooks are disabled: `.claude/settings.json` `permissions.deny`
   (`mcp__neon__delete_*`, `mcp__vercel__deploy_*`, …) and `.cursor/cli.json` (`Mcp(neon:delete_*)`, …) for the Cursor CLI.
4. The shell guard now also blocks the Neon CLI, `vercel … --prod` in any position, `vercel env add|rm|pull`,
   `migrate:down`, force pushes via `+refspec`, and split-flag `rm -r -f ~`. Both guards fail closed in Cursor.
   Rules are unit-tested with blocked/allowed examples in `tests/unit/agent-guards.unit.spec.ts`.

**What is NOT enforced — be honest about it.**

- **Cursor Cloud Agents do not run `beforeMCPExecution` hooks** (documented limitation). There, only Neon's read-only
  mode applies, so a cloud agent with Neon MCP can still run `SELECT` on production, and the Vercel MCP is unrestricted.
  Do not authorize Neon/Vercel MCP for cloud agents, or authorize Neon with a project-scoped, read-only OAuth grant on a
  non-production project.
- Claude Code treats a crashing hook (exit code other than 2) as "allow"; only the static deny rules remain then.
- MCP permissions follow the OAuth account you authorize. The real boundary is the account: use a Neon role/project and
  a Vercel account/team without production access for agent work where possible.
- Regex shell rules are best-effort: `bash -c "$(echo …)"`, scripts written to disk and run later, or Node code calling
  `pg` directly are not detected. A production `DATABASE_URL` in your local `.env` would be used by `pnpm seed` and the
  dev server — keep production URLs out of `.env`.
- Other MCP servers (Chrome DevTools, Playwright, Context7) are not restricted; they don't hold database credentials.

**Consequences.** Agents can still read Vercel logs/deployments and Neon project metadata, and query dev branches you
explicitly allow. Anything that writes to Neon/Vercel or reads production data is a human action.
Revisit if: Vercel ships a read-only/scoped MCP mode, or Cursor runs MCP hooks in cloud agents.

## Passwordless login with email one-time codes

Ported from hht-research-platform. No passwords to leak, reset or brute-force; admins are few and
already live in their inbox. Codes are HMAC-hashed, expire in 10 minutes, burn after 5 wrong tries;
rate limits (3 per email / 15 min, 20 per IP / hour) are counted in Postgres because serverless
instances share no memory. Session = our own signed cookie read by a Payload auth strategy, since
Payload's JWT flow is tied to the disabled local strategy. Mutations are Server Actions, not route handlers.
Revisit if: we need SSO/OAuth or customer-facing accounts (then consider Better Auth).

## Local dev uses Payload push; production uses migrations

Push keeps iteration fast (no migration per field tweak). Migrations are generated once per merged change and applied in the Vercel build (`pnpm build:vercel`), not on cold start, so requests never wait on DDL.
Revisit if: several people work on the schema at the same time.

## Payload inside the Next.js app instead of a separate CMS/API

One deploy, one repo, Local API calls without network hops, admin panel for free. Waitlist and changelog are Payload collections.
Revisit if: the admin needs to scale independently or a non-JS client needs heavy API traffic.

## Postgres on Neon via `@payloadcms/db-postgres`

Relational data, branching per preview deploy, scales to zero. The standard `pg` pool works with Neon's pooled connection string.
Revisit if: we need edge-runtime DB access (then look at the Neon serverless driver).

## CSS Modules + CSS variables, no utility framework

Zero runtime, no build plugin, easy for agents to follow one convention. Tokens live in `src/app/(frontend)/globals.css`.

## Server Actions + Zod for mutations

No hand-written REST layer for our own UI. Zod schemas live in `features/*/schema.ts` and are shared by client and server.
Payload's REST/GraphQL stays available for admin and future integrations, but private collections are closed to it.

## Pinned toolchain versions

- TypeScript 6.0: typescript-eslint (used by eslint-config-next) supports `<6.1`; TS 7 (native) is not supported yet.
- ESLint 9: eslint-plugin-react / import / jsx-a11y bundled by eslint-config-next do not support ESLint 10 yet.
- graphql 16: Payload 3 peer range is `^16.8.1`.
- Next.js ≥16.3.3: minimum supported by Payload 3.90 on the 16.x line.
  Revisit on each Payload minor release (`pnpm outdated`).

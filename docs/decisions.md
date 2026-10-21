# Decisions

Short log of choices that shape the codebase. Newest first. One entry = what we chose, why, and what would make us revisit it.

## 2026-10-21 — PROPOSED: provider-agnostic `src/lib/ai/`, off without a key

> **Status: PROPOSED — not implemented.** No code, env vars or dependencies exist yet. Acceptance criteria live in
> `docs/stories/004-ai-baseline.md` (`status: draft`). Approving that story turns this entry into a decision.

**Context.** Three products built near this template call an LLM, and each one rebuilt the same guard-rails, each with
its own blind spot: one fenced untrusted text but checked the spend limit and recorded the cost in two separate
steps (two concurrent requests can both pass the check); one reserved usage atomically, but with raw SQL outside
any ORM; one wrapped untrusted text in a tag and stripped lookalikes, but had no budget at all. The next product
should start with the union of what worked.

**Options.** (a) Keep it per product: each one copies whatever its predecessor had. (b) Pick a provider SDK (Vercel AI
SDK, an official vendor SDK) and build on it. (c) A small, provider-agnostic `src/lib/ai/` built on `fetch`, with the
guard-rails as pure, separately tested modules and one provider adapter per vendor.

**Decision (proposed).** (c):

- `src/lib/ai/` holds `client.ts` (one `complete()` entry point: system + user prompt, optional Zod output schema,
  `maxOutputTokens`, returns text/object + token usage), `providers/<vendor>.ts` (one `fetch`-based adapter each,
  chosen by `AI_PROVIDER`), and the guard-rails `fence.ts`, `budget.ts`, `ledger.ts`, `retry.ts`, `coalesce.ts`,
  `pricing.ts`. Features call `complete()` from their `service.ts`, never a vendor API.
- **Off by default**, like Resend/Sentry/Blob/analytics: `AI_PROVIDER=none` (default) or no `AI_API_KEY` →
  `isAiEnabled()` is false, `complete()` never touches the network and features return the error code `ai_disabled`.
- **Money is integer micro-USD** everywhere (estimate, ledger, limits), so the atomic counter stays an integer and
  sums don't drift. The estimate is ours (price table × tokens), not the vendor's invoice — a guard against
  overspend, not accounting.
- **The ledger is the one place allowed to run SQL.** Atomic "add only if it stays under the limit" needs a
  conditional upsert; Payload's Local API can only read-then-write, which races (see the story's "Raw SQL vs
  Payload"). The counters table is a hidden Payload collection (schema and migrations stay Payload's), and a single
  statement goes through `payload.db.drizzle` inside `ledger.ts`. A unit test keeps that the only file that does so.
- No new dependency: a provider SDK can be proposed later behind the same `complete()` signature.

**Consequences (if approved).** New env vars (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_MONTHLY_LIMIT_USD`,
`AI_USER_MONTHLY_LIMIT_USD`) in `src/lib/env.ts` + `.env.example`; a narrow, documented exception to the "No raw
SQL, no Drizzle calls" rule in `AGENTS.md`; a migration for the counters collection; a new baseline row; a manual
`pnpm ai:judge` script whose reports live in `docs/quality/<date>/`. Coalescing is per server instance only.
Revisit if: a product needs streaming or tool use (`complete()` is request/response only), Payload gains an atomic
conditional increment, or a provider SDK becomes worth its weight across all products.

## 2026-10-21 — Template docs: a start-a-product guide, a cherry-pick log, and empty ledgers

**Context.** The first product made from this template wrote its own bootstrap notes; later fixes in sibling repos
reached the template only by hand-diffing, and derived repos can't `git merge` the template (unrelated histories).

**Decision.** `docs/new-product.md` is the generic path from template to first story (rename, Vercel + Neon with a
database branch per Preview, env vars per environment, Codex cloud, Claude Code on the web, dev container, Operator,
first cycle, saving limits). `node scripts/rename-product.mjs <slug> "<Name>"` does the mechanical rename (package,
`siteConfig.name`, `Metadata.siteName`, README title, AGENTS intro; pure function, unit-tested). `docs/template-changes.md`
lists every improvement with its commit SHA for `git cherry-pick`; that only works if template PRs are merged with
merge commits, not squashed. `docs/spikes/_template.md`, `docs/incidents/_template.md` and `docs/security/README.md`
(empty review ledger) give research answers, post-mortems and security reviews a fixed shape.

**Consequences.** Every template PR adds its rows to `docs/template-changes.md` after its commits exist (a final
"record sources" commit). Squash-merging a template PR breaks the SHAs in that log.
Revisit if: products start diverging so much that cherry-picks rarely apply (then publish shared code as a package),
or a second maintainer joins (then a CHANGELOG with releases beats a log of SHAs).

## 2026-10-21 — Default share image: one generated card per locale, fonts from the repo

**Context.** Links to the site showed no preview image. A sibling product renders its cards with `next/og` and fonts
bundled in the repo, because the default font lacked its scripts and was otherwise fetched at render time.

**Decision.** `src/app/(frontend)/[locale]/opengraph-image.tsx` renders `renderSiteCard()` (`src/lib/og-image.tsx`):
`siteConfig.name`, the localized `Metadata.tagline`, and the site host, 1200×630 PNG, prerendered per locale
(`generateStaticParams`). Fonts: static Geist 400/600 TTFs in `src/fonts/files/` (Satori reads neither WOFF2 nor
variable weights). Next 16.4's `next/og` bundles Geist Regular with Cyrillic, so the files are for the semi-bold weight
and so the card doesn't depend on Next's internal default (older versions fell back to a Latin-only font and fetched
missing glyphs from Google Fonts). Next links the default locale's card as `/en/opengraph-image-…`; `src/proxy.ts`
skips `*/opengraph-image*`, otherwise the locale proxy 307s every crawler to an unprefixed URL. CSP: nothing changes —
the card is rendered on the server and the page only references its URL in `<meta>`.

**Consequences.** Absolute image URLs come from `metadataBase` = `siteUrl()`; set `NEXT_PUBLIC_SITE_URL` in Production
so cards point at the real domain. A page that needs its own card adds an `opengraph-image.tsx` next to it.
Revisit if: a page needs per-document cards (title, date), or a product changes typefaces (replace the TTFs too).

## 2026-10-21 — SEO: robots and sitemap per environment, hreflang from one helper

**Context.** The site had hreflang in the page head but no `robots.txt` or sitemap, and `metadataBase` read
`NEXT_PUBLIC_SITE_URL` only (localhost on previews where it is unset). Vercel marks previews `noindex` by header, but
nothing said so for a custom domain, and nothing told crawlers where the pages are.

**Decision.** `src/app/robots.ts` + `src/app/sitemap.ts` over pure builders in `src/lib/seo.ts`. Robots: indexing only
when `VERCEL_ENV=production` (allow `/`, disallow `/admin` and `/api/`, advertise the sitemap); everything else
disallows `/`. Sitemap: every public page once per locale, each with the hreflang map from `languageAlternates()` in
`src/i18n/alternates.ts` (the same helper `alternatesFor` uses for the page head), `lastModified` from the newest
published changelog entry (`updatedAt` or `publishedAt`, read with `overrideAccess: false`). Both routes are
`force-dynamic`: robots must answer for the deployment it runs on, and the sitemap is crawled rarely.
`siteUrl()` (`src/lib/site-url.ts`): `NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` →
localhost; `metadataBase` uses it too. No `host` directive (Yandex dropped it).

**Consequences.** New public pages must be added to `src/app/sitemap.ts` (and `tests/helpers/public-pages.ts`; the
e2e compares the two). Production indexability is still only checked by hand — preview smoke can't see it.
Revisit if: pages per changelog entry or other content pages appear (one sitemap entry per document), or the sitemap
passes a few thousand URLs (split with `generateSitemaps`).

## 2026-10-21 — Local fonts: Geist is vendored, the build fetches nothing from Google Fonts

**Context.** `next/font/google` downloads fonts during `next build`. Google can return extensionless URLs that break
Next's loader ([Next.js #99114](https://github.com/vercel/next.js/issues/99114)); on 2026-10-15 that failed a derived
product's dependency-update Preview and its local production build. Offline or behind a proxy, the build fails too.

**Decision.** `src/fonts/site.ts` loads Geist and Geist Mono with `next/font/local` from variable WOFF2 files (Latin +
Cyrillic, weight 100–900) in `src/fonts/files/`, with their OFL licenses and pinned upstream in `src/fonts/README.md`.
CSS variable names (`--font-geist-sans`, `--font-geist-mono`) are unchanged. `tests/unit/fonts.unit.spec.ts` fails if
`next/font/google` is imported again or a file lacks its license/README row. Verified: with a dead `HTTPS_PROXY`
(`NODE_USE_ENV_PROXY=1`), `pnpm build` failed with Google fonts and passes with local ones.

**Consequences.** No new CSP origin or runtime request. ~140 KB of font files in the repo. Updating Geist means
refreshing files and licenses by hand from a pinned commit.
Revisit if: a product changes typefaces (put the new files and licenses in `src/fonts/` the same way), or the Google
loader is fixed and vendoring stops paying for itself.

## 2026-10-21 — Dependencies: pins follow a derived product's green CI; one Dependabot group for minor/patch

**Context.** The template's pins (Payload 3.90.2, Next 16.3.8, `@types/node` 22) fell behind a product built from it,
which runs Payload 3.91.0 / Next 16.4.2 / `@types/node` 24 green in CI. Four Dependabot groups (payload, react, next,
dev-tools) meant up to four PRs a week to review alone, and Dependabot proposed `@types/node` 26 for a Node 24 runtime.

**Decision.** Bump to the derived product's versions (README → Versions). Dependabot: a single `npm-minor-patch`
group (`patterns: ['*']`, minor + patch); majors stay ungrouped, one PR each. `@types/node` majors are ignored — the
types follow the runtime (`engines`, `.nvmrc`), bumped by hand with it. pnpm warns that Vite's optional `esbuild`
peer (`^0.27 || ^0.28`) resolves to 0.25 (pulled by `drizzle-kit`); Vite 8 bundles with Rolldown, nothing breaks.
Re-ran the 2026-10-20 migrate experiment on 3.91.0: with the last migration moved aside and `PAYLOAD_DB_PUSH=true`,
`payload migrate` still did not push its column.

**Consequences.** One red package blocks the whole weekly group: find it in the CI log, then either fix it in the
group PR or add an `ignore` for that version and let the rest merge. Majors still need reading the changelog.
Revisit if: group PRs are red more often than not (split out the offender), or the runtime moves to Node 26.

## 2026-10-20 — Preview smoke: health + Lighthouse on every Vercel Preview, SEO without `is-crawlable`

**Context.** CI tests a dev server; nothing looked at a real deployment (production build, Neon branch, Vercel
functions) before merge. A sibling project runs a smoke job on Vercel's `deployment_status` event.

**Decision.** `.github/workflows/preview-smoke.yml`: on a successful deployment whose environment starts with
`Preview`, call `/api/health` (retries for cold starts; must contain `"ok":true`), run Lighthouse 12.8.2 (pinned, via
`npx`, not a dependency) on `/` and `/changelog`, gate the scores with `scripts/lighthouse-check.mjs` (performance 0.8,
accessibility / best-practices / SEO 0.9) and upload JSON + HTML reports as artifacts. Previews are behind Vercel
Authentication, so requests carry `x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET`; **without the
secret the job emits a notice and skips** — new products start without it. **SEO:** Vercel sends
`X-Robots-Tag: noindex` on previews, so `is-crawlable` always fails there; the gate recomputes the SEO score from its
weighted audits without that one audit (every other SEO audit still counts) rather than dropping SEO entirely.

**Consequences.** Indexability of production is not checked anywhere — check `/robots.txt` and headers after the
first production deploy. Lighthouse on shared runners is noisy; perf 0.8 (mobile emulation) may flake. The bypass
header is sent on every request the audited page makes — fine while all requests are same-origin; revisit before
adding third-party scripts.
Revisit if: perf flakes (median of several runs, or `--preset=desktop`), third-party origins are added, or a
production smoke is wanted (needs a separate, unprotected target).

## 2026-10-20 — Accessibility floor: axe on every public page, serious/critical only, both themes

**Context.** Nothing checked accessibility automatically. The first axe run found three real `serious` issues: white
text on the orange button (3.6:1 light; 2.6:1 in dark mode), the green "improvement" tag on its own tint (4.3:1), and
the language switcher's `aria-label="English"` on a link that shows `EN` (WCAG 2.5.3 label-in-name).

**Decision.** `@axe-core/playwright` (dev). `tests/e2e/a11y.e2e.spec.ts` runs axe on each page in
`tests/helpers/public-pages.ts` (shared with `devtools.e2e.spec.ts`) on desktop and mobile, in light and dark
`prefers-color-scheme`, and fails on `serious`/`critical` only; all violations are attached to the report. Plus
landmarks: one `<main>`, one `h1`, `<html lang>`. Fixes: tokens `--color-button` / `--color-button-hover` /
`--color-on-button` and `--color-success-strong` (light and dark values), switcher name = visible code + visually
hidden language name. Next's dev overlay (`nextjs-portal`) is excluded.

**Consequences.** New public pages must be added to the shared list to be checked. `minor`/`moderate` findings don't
fail CI. Axe can't judge announcements or focus order — those are rules in `src/components/AGENTS.md`.
Revisit if: a page needs a justified exception (disable that rule for that selector, with a comment), or `moderate`
findings start piling up in the attachments.

## 2026-10-20 — Migrations are checked twice: statically, and applied to an empty database in CI

**Context.** Local databases get their schema from Payload's dev push, so a migration that misses something is
mended silently everywhere except production. A sibling project shipped a new collection whose migration created its
tables but not its `<slug>_id` column in `payload_locked_documents_rels`; Payload reads that column on every write
to any collection, so production broke on saving a user. That project also concluded that `payload migrate` pushes
before migrating locally, which would make any "fresh database" check meaningless.

**Finding (Payload 3.90.2, verified by experiment).** `payload migrate` does **not** push, whatever `PAYLOAD_DB_PUSH`
says: the CLI sets `PAYLOAD_MIGRATING=true` before init, and `@payloadcms/db-postgres` skips `pushDevSchema` then.
With the last migration file moved aside, an empty database stayed without its tables even with `PAYLOAD_DB_PUSH=true`.
(The sibling project ran migrations through its own config, where push followed `NODE_ENV`.) Two more facts: the CLI
applies the files in `src/migrations` sorted by name (`index.ts` is not consulted), and on a database that was ever
pushed (a `batch = -1` row) migrate asks for confirmation and, without a TTY, **hangs**.

**Decision.** (1) `tests/unit/migrations.unit.spec.ts` replays the `up()` SQL in file order, without a database:
every collection from the sanitized config has its table, its `<slug>_id` in `payload_locked_documents_rels` (auth
collections also in `payload_preferences_rels`), nothing alters or references a table before it exists, names are
unique Payload timestamps, and `index.ts` lists them in the same order. (2) CI job `migrations`:
`scripts/check-migrations.sh` refuses a non-local or non-empty database, applies all migrations with
`PAYLOAD_DB_PUSH=false` under a 5-minute timeout, and checks every file was recorded; then `pnpm test:int` runs against
that schema with push off. With the `auth_codes_id` column cut from its migration, migrate still succeeded — 34 int
tests then failed with `column … auth_codes_id does not exist`, and the unit spec failed too.

**Consequences.** A schema change without a matching migration fails the PR, not production. The CI run is ~2 minutes
longer. The static parser understands Payload-generated SQL; hand-written migrations must keep that shape.
Revisit if: Payload changes the migrate CLI (re-run the experiment in `scripts/check-migrations.sh`'s header), or a
migration legitimately needs SQL the parser can't read.

## 2026-10-20 — Daily encrypted database backup by email (supersedes 2026-10-01 "rely on Neon instant restore")

**Context.** The 2026-10-01 decision relied on Neon's history window. On the free plan that is 6 hours: it undoes the
last mistake, not a deletion noticed a week later. Two sibling products had already added their own copy (sources: `docs/template-changes.md`).

**Options.** (a) `pg_dump` to S3/R2 — Vercel functions have no Postgres binaries, and a bucket plus credentials is one
more account per product. (b) Data-only dump in Node, encrypted, mailed to the owner — no new service; the mailbox
keeps history. (c) Stay with Neon only.

**Decision.** (b), with the stronger of the two sibling designs ( dump through Payload's pool in
one `REPEATABLE READ READ ONLY` snapshot; restore refuses non-empty targets instead of deleting first; NOT NULL
foreign keys order the inserts and nullable ones are filled in a second pass, so cycles work; JSON columns encoded by
type) plus the other one's dump-version check. `src/lib/backup/` + `GET /api/cron/backup` (cron auth, `maxDuration`
300, daily in `vercel.json`), gzip + AES-256-GCM with `BACKUP_KEY`, mailed via the mail gate as `operator` mail
(base64 attachment: the Resend adapter sends JSON). Skips `auth_codes`, `users_sessions`, Payload locks/kv and
`payload_migrations`. Off unless `BACKUP_EMAIL` + `CRON_SECRET`; once configured every failure (missing key, DB error,
over 25 MB, mail refused) sends "backup NOT made". `pnpm backup:verify` (no DB) and `pnpm backup:restore` (empty
target, one transaction, sequences reset, remote needs `ALLOW_REMOTE_DATABASE=1`). An int test restores a real dump
with the real script into a fresh database and compares row counts.

**Consequences.** Recovery point for Postgres: last night's copy (or inside Neon's window). Copies hold PII (emails),
encrypted; the key lives only in the password manager. Vercel Blob media are **still not backed up** — Backups stays
`partial` in the baseline. Restore needs the schema of the backup's date (code from that commit). Past ~25 MB
encrypted, email no longer fits: the failure email says so.
Revisit if: the copy nears the cap, users upload files (back up Blob too), or compliance needs storage outside email.

## 2026-10-20 — Raw SQL allowed in `src/lib/backup/` only

**Context.** `AGENTS.md` forbids raw SQL and Drizzle calls: data goes through the Payload Local API. A backup must read
and write every table, including Payload's internal ones, inside one snapshot/transaction, and reset sequences — none
of which the Local API offers.

**Decision.** A narrow exception: SQL through `payload.db.pool` (the `pg` pool `@payloadcms/db-postgres` already
holds) is allowed in `src/lib/backup/` only, and only for the dump/restore mechanics. Identifiers come from
`information_schema` and are quoted; values are parameters. Tests may use the pool to verify backups. Everything else
still uses the Local API.

**Consequences.** One folder to review carefully when touching SQL; reviewers treat raw SQL anywhere else as a finding.
Revisit if: Payload ships a supported export/import.

## 2026-10-20 — `GET /api/health`: database round-trip, nothing else

**Context.** No endpoint said "the app is up and can reach Postgres". Uptime monitors had to load a page, and
Playwright's `webServer.url` waited on `/`, which answers before Payload is initialised (a product built from the template had to
point it at `/changelog` to force Payload's first-request schema push).

**Decision.** `src/app/api/health/route.ts`, a plain Next route (the static segment wins over Payload's
`api/[...slug]`; `src/proxy.ts` skips `/api`; e2e checks both). Body `{ ok, db: 'up'|'down', commit, checkedAt }`
(`commit` = first 7 of `VERCEL_GIT_COMMIT_SHA`, else `local`), `Cache-Control: no-store`, 200/503. The database check
is `payload.count({ collection: 'users' })` with a 5 s timeout — a COUNT returns no documents (Payload's
`find({ limit: 0 })` would mean "no limit", so it is not used). No counts or hosts in the response. Failures go to
`captureServerError`. `playwright.config.ts` waits on it; Playwright keeps polling while it answers 503.
Builder pattern from a sibling product.

**Consequences.** Each call is one tiny query; a monitor polling every minute keeps a Neon compute awake (scale-to-zero
won't kick in) — poll less often if that matters.
Revisit if: products need deeper checks (queues, third parties) — add them as separate fields, keep `ok` meaning "serving".

## 2026-10-20 — Mail gate: only login codes leave previews and the sandbox sender

**Context.** Previews usually share the production Resend key and sender and run on a branch of the production
database, so an invite or notification triggered on a preview URL would reach real people from the production domain.
The `@resend.dev` sandbox sender delivers only to the Resend account owner; other mail from it is dropped silently.
The template sends only login codes today; products add the rest.

**Decision.** `src/lib/mail-gate.ts` (ported from a sibling product): `sendMail(payload, kind, message)` is
the one door. `login-code` always passes (signing in to a preview must work); `operator` (backup reports to
`BACKUP_EMAIL`) is refused on previews but allowed from the sandbox, which delivers to the owner; `general` is refused
on previews and from the sandbox. Refusals and a missing `RESEND_API_KEY` come back as a result, not an exception.
`EMAIL_FROM_ADDRESS` accepts `Name <address>`; the name replaces the site name as the sender name.
`src/features/AGENTS.md` tells agents to use the gate for any new mail.

**Consequences.** Testing invite mail end-to-end needs production or a local run with a verified sender. A product
whose previews have their own Resend key and sender can relax the preview rule there.
Revisit if: previews get separate mail credentials, or a product needs preview mail to a fixed test inbox.

## 2026-10-20 — Cron routes fail closed without `CRON_SECRET`

**Context.** Vercel Cron calls routes with `Authorization: Bearer $CRON_SECRET`. The common pattern
`!secret || header === …` opens the route whenever the secret is missing — on previews, which usually don't get the
variable and whose database is a branch of production. A sibling product had exactly that bug in its backup route.

**Decision.** `src/lib/cron-auth.ts` (ported from two sibling products): with a secret, the header must match
exactly, compared as SHA-256 digests with `timingSafeEqual` (constant time, any length); without one, allowed only when
`VERCEL_ENV` is unset (local runs). Env is a parameter, so every branch is unit-tested. `CRON_SECRET` must be ≥ 16
characters (`env.ts`).

**Consequences.** Set `CRON_SECRET` in Vercel (Production) before relying on any cron; without it the cron calls get
401 and the job silently doesn't run — the backup's "no email that day" rule makes that visible.
Revisit if: Vercel signs cron requests some other way.

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
`20261020_095132_media_blob_fields` adds `prefix` (default `''`) and `_objectkey`. Pattern from a sibling product,
where it was a hand-built path; here the plugin does it.

**Consequences.** Preview uploads accumulate under `preview/` and are never cleaned up automatically — delete the
folder from the Blob store now and then. Rows a preview inherits from production keep `prefix = ''` and still show
the production files; deleting such a row on a preview would delete the production file, so don't.
Revisit if: previews get their own Blob store, or Payload v4 makes `alwaysInsertFields` the default.

## 2026-10-20 — Local tooling refuses remote databases; push is local-only

**Context.** Push and the scripts used whatever `DATABASE_URL` the process saw. One `vercel env pull` (which writes
production secrets into `.env*.local`) followed by `pnpm dev` would push the dev schema into Neon production — push
drops columns it doesn't know. `pnpm seed` would write a demo admin into production. The decision on MCP guards
already noted "a production `DATABASE_URL` in your local `.env` would be used by `pnpm seed` and the dev server".

**Decision.** `src/lib/database-target.ts` (ported from a sibling product, plus the seed guard of a product built from the template), with the
resolved URL:

- Push only when requested **and** the host is local (`localhost`, `127.0.0.1`, `::1`, `postgres`,
  `host.docker.internal`) **and** `NODE_ENV !== 'production'`. No remote-push opt-in (the source had one for deploy builds;
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
Ported from sibling products (selection and TLS; the `KEY=` fix).

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

**Superseded on 2026-10-20** by "Daily encrypted database backup by email" — the Postgres part only; the Blob gap
and the quarterly drill still stand.

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

Ported from a sibling product. No passwords to leak, reset or brute-force; admins are few and
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

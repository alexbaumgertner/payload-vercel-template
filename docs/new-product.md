# Starting a new product from this template

The path from "new idea" to "first story in production", in order. Human steps are marked **(you)**; everything else an
agent can do in a checkout. Production steps are always yours — agents never touch production (`AGENTS.md` → Database).

## 0. Once, on the template repo **(you)**

GitHub → template repo → **Settings → General → Template repository** (checkbox). Without it, `--template` below fails.

## 1. Create the repo

```bash
gh repo create <slug> --template alexbaumgertner/payload-vercel-template --private --clone
cd <slug>
node scripts/rename-product.mjs <slug> "<Product Name>"
```

The histories of the template and the new repo are unrelated (GitHub copies files, not commits). To pull a later
template improvement, cherry-pick it by the SHA listed in `docs/template-changes.md`:

```bash
git remote add template https://github.com/alexbaumgertner/payload-vercel-template
git fetch template
git cherry-pick <sha>        # not merge: unrelated histories
```

## 2. Rename checklist

`rename-product.mjs` covers the mechanical part: `package.json` name, `siteConfig.name` in `src/config/site.ts`,
`Metadata.siteName` in `messages/*.json`, the README title and the first paragraph of `AGENTS.md`. Then by hand:

- [ ] `messages/en.json` + `messages/ru.json`: `Metadata.description`, `Metadata.tagline` (share image), `Home.*` copy.
      Shipping English only: README → Languages.
- [ ] `AGENTS.md` first paragraph: say what the product is (the script only swaps the name).
- [ ] `docs/product.md`: who it is for and what it must do — agents read it before every story.
- [ ] `docs/stories/`: keep 001–003 as examples or delete them; new stories start at the next number.
- [ ] `docs/template-changes.md`, `docs/security/README.md`: keep (empty ledgers are fine).
- [ ] Typeface (optional): `src/fonts/README.md` → Updating.
- [ ] `pnpm check` and `grep -ri "indie starter" --exclude-dir=node_modules .` before the first commit.

## 3. Vercel + Neon **(you)**

1. Vercel → **Add New → Project** → import the repo. `vercel.json` sets the build to `pnpm build:vercel`
   (`payload migrate`, then `next build`).
2. **Storage → Neon** (Marketplace) → connect to the project, and enable **a database branch per Preview
   deployment**. Previews then migrate and seed their own branch; production data is never touched by a PR.
3. **Storage → Blob** → connect (media uploads; previews write under `preview/`).
4. Add the variables below, then deploy.
5. First user, once, from your machine: `docs/runbooks/production-admin.md`.
6. Before launch: Neon history window + one restore drill, `docs/runbooks/backup-restore.md`.

## 4. Environment variables by environment

Source of truth: `src/lib/env.ts` and `.env.example`. Everything optional is off when unset.

| Variable                                               | Production                                                 | Preview                                     | Local (`.env`, `.env.*.local`)    |
| ------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------- | --------------------------------- |
| `DATABASE_URL`                                         | Neon integration (pooled)                                  | Neon integration (branch per preview)       | local Postgres                    |
| `PAYLOAD_SECRET`                                       | `openssl rand -hex 32`                                     | a different value                           | any 16+ chars                     |
| `NEXT_PUBLIC_SITE_URL`                                 | `https://<your-domain>`                                    | unset — check `/admin` saves on a preview ¹ | `http://localhost:<port>`         |
| `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`                 | required for login                                         | same, if you sign in on previews            | unset: codes print to the console |
| `BLOB_READ_WRITE_TOKEN`                                | Blob integration                                           | Blob integration                            | unset: `./media`                  |
| `CRON_SECRET`                                          | `openssl rand -hex 32`                                     | unset (cron runs only in Production)        | unset (cron routes open locally)  |
| `BACKUP_EMAIL`, `BACKUP_KEY`                           | your mailbox; `openssl rand -base64 32` → password manager | unset                                       | unset                             |
| `SENTRY_DSN` (+ `SENTRY_ORG`/`_PROJECT`/`_AUTH_TOKEN`) | optional                                                   | optional                                    | unset                             |
| `ANALYTICS_PROVIDER`                                   | `vercel` once Web Analytics is on                          | `none`                                      | `none`                            |

GitHub → Settings → Secrets → Actions: `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel → Deployment Protection → Protection
Bypass for Automation) turns on the preview smoke check; without it the job skips. CI needs no other secrets.

Vercel provides `VERCEL_ENV`, `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` itself: `robots.txt` allows indexing only
when `VERCEL_ENV=production`, and the site URL falls back to the production domain when `NEXT_PUBLIC_SITE_URL` is unset.

¹ Payload's `serverURL` is `NEXT_PUBLIC_SITE_URL` (default `http://localhost:3000`), and the admin builds its API URLs
from it. Until that is resolved in the template, try one save in `/admin` on the first Preview.

## 5. Agent environments

**Codex cloud** — chatgpt.com/codex → Settings → Environments → Create → this repo:

- Setup script: `bash scripts/cloud-setup.sh` (Postgres, dev + test databases, deps, `.env`, Chromium; idempotent).
- Agent internet access: off — dependencies are installed during setup. No secrets: the database is local.
- Enable **Code review** for the repo, then `@codex review` on a PR runs it.
- Codex reads `AGENTS.md`, not `CLAUDE.md`, and does not run the shell/MCP guards (`AGENTS.md` → Agent hooks).

**Claude Code on the web** — claude.ai/code → connect the repo. The `SessionStart` hook in `.claude/settings.json`
starts Postgres when `CLAUDE_CODE_REMOTE=true`. If `apt-get install postgresql` is blocked, allow `archive.ubuntu.com`
in the environment's network settings.

**Dev container** (Zed, VS Code, Codespaces, `npx @devcontainers/cli up --workspace-folder .`) — `.devcontainer/` brings
Node 24, Postgres 18, Claude Code and Codex; logins live in shared volumes, so you sign in once for all products.
On a Mac, OrbStack is the lighter Docker.

**Operator (home-server orchestrator)** — runs unattended sessions, one git worktree per task on `agent/<task-id>`:

- Give each worktree its own databases and port: `bash scripts/local-env.sh <suffix>` (`AGENTS.md` → Parallel checkouts).
- The orchestrator's environment wins over `.env.*.local`: unset an inherited `PORT` (its own server's port) and
  `NODE_ENV=production` before `pnpm dev` / tests.
- Nobody answers mid-run: use `docs/prompts/implement-story.md`, which asks for the conservative option and open
  questions in the PR.
- On a busy machine, run e2e as CI does (`pnpm test:e2e --workers 1`): parallel workers make the dev server recompile
  and `networkidle` checks time out.

## 6. First cycle

1. Fill `docs/product.md`. Record any choice that differs from the template (default locale, auth) in `docs/decisions.md`.
2. Plan the first epic in Claude Code (plan mode, strongest model) with `docs/prompts/plan-epic.md`; it writes draft
   stories in `docs/stories/`. Review them and set `status: approved`.
3. Order: stories that change collections or access first and one at a time (they make migrations); UI-only stories
   in parallel — Codex cloud or Operator with `docs/prompts/implement-story.md`, or Claude Code `/feature`.
4. Review every PR (`@codex review`, or `docs/prompts/review-pr.md` with the `reviewer` subagent); auth and access
   changes get both. CI green + preview smoke green → merge → production migrates on deploy.
5. Open questions that need research go to a deep-research tool with `docs/prompts/research-spike.md`; the result
   becomes `docs/spikes/NNN-*.md` (template: `docs/spikes/_template.md`).

## 7. Saving limits

- Strongest model for planning and review; a cheaper one (`/model sonnet`) for implementing an approved story.
- One story per session; `/clear` between stories.
- `.mcp.json` has five servers. Day to day `context7` and `chrome-devtools` are enough (`playwright` overlaps the
  latter); disable the rest with `/mcp`.
- Let CI and preview smoke do the slow checks; locally run the single spec you are changing (`CLAUDE.md` → Running a
  single test), then the full suites once before the PR.

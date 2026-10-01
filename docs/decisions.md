# Decisions

Short log of choices that shape the codebase. Newest first. One entry = what we chose, why, and what would make us revisit it.

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

1. `.cursor/mcp.json` and `.mcp.json` use `https://mcp.neon.tech/mcp?readonly=true`: Neon removes write tools and
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

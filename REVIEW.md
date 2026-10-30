# REVIEW.md

What a reviewer — the `reviewer` subagent, `/code-review`, Codex review or a human — checks in this repo, and how it
reports. `AGENTS.md` → "Code Review Rules" stays the short P0/P1 list; this file is the full contract.

## What "broken" means here

A change is broken when it does one of these. Look for them first, in this order:

1. **Leaks.** Non-public data (drafts, other users' records, emails, auth codes, session cookies) reaches an anonymous
   visitor, a log, an analytics prop or a client bundle. Public reads without `overrideAccess: false`. A `server-only`
   module imported from a client component.
2. **Loses data.** A collection or field change without a migration in `src/migrations/`; a migration that drops
   instead of renames; editing a migration that has already been applied; a `localized` field without the
   copy-to-default-locale step.
3. **Weakens auth.** Anything in `src/features/auth/` that changes identical responses for unknown emails, HMAC-only
   storage, `timingSafeEqual`, rate limits, TTL or same-origin redirects.
4. **Trusts input.** A Server Action or Local API write on behalf of a visitor without Zod `safeParse` first.
5. **Can't be undone.** A change with no way back: data rewritten in place, an env var renamed without a fallback, a
   third-party call that runs on deploy.
6. **Lies to the user.** UI copy outside `messages/*` or in one locale only; an error shown as success; missing
   empty / loading / error state; broken at 360px.

Everything else in `AGENTS.md` (CSS Modules, feature folder shape, no new deps) is a convention: report it, but it is
never Important on its own.

## Severity tags

Every finding carries exactly one tag:

- **Important** — one of the six above, or a bug a user would hit. Must be fixed or answered before merge.
- **Nit** — convention, naming, readability. At most **3 nits** per review; drop the rest.
- **Pre-existing** — a real problem in code this PR did not introduce (check with `git blame` / `git diff main...HEAD`).
  Never blocks the PR; list them at the end so they become a separate task.

Not findings: style the formatter or linter already enforces, "consider adding a comment", alternative designs
without a concrete defect, anything you can't point to.

## Evidence

- Every finding has `path:line`, the concrete failure ("anonymous GET /api/changelog?draft=true returns drafts"), and
  a minimal fix. A guess from a function name is not a finding — open the file.
- When the same mistake appears in several places, report the **class** once and list every location, so the author
  fixes all of them in one pass.

## Skip

- `src/payload-types.ts`, `src/app/(payload)/**`, `src/migrations/*.json` — generated.
- `pnpm-lock.yaml` beyond "a dependency was added without being asked".
- The `nextjs-agent-rules` block in `AGENTS.md` — written by `next dev`.

## Rounds

- Round 1 reviews the whole diff against `main`. From round 2, review **only what changed since the last review**:
  `git diff <last-reviewed-sha>` (new commits plus staged and unstaged fixes) and new untracked files. An empty
  re-review diff means the findings were not addressed, not that the change is clean. Don't repeat findings that are
  already posted or answered.
- After **3 rounds** with new Important findings, stop reviewing and say: "Three rounds still find Important issues —
  step back and reconsider the approach." Don't start round 4.
- Deep review (every file, `git blame` on touched functions, run the tests yourself) only for High-risk PRs
  (`node scripts/risk-tier.mjs` → High). Low and Medium get one standard pass.

## Output

Start with the count, then the findings, then the verdict:

```
2 Important, 1 Nit, 1 Pre-existing

- Important — src/features/waitlist/actions.ts:31 — Server Action writes before Zod parse; a crafted request stores
  arbitrary `source` — move safeParse above service.add()
- Nit — …
- Pre-existing — …

Verdict: fix Important first
```

When there is nothing to fix, say exactly `0 findings — ship it.` No praise, no summary of what the PR does.

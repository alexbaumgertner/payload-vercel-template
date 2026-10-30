---
name: ship
description: Verify, review, commit and push the current work. Use when the user runs /ship.
disable-model-invocation: true
---

# /ship

1. `pnpm check` — fix failures and re-run until green.
2. If files in `src/collections/` or `src/payload.config.ts` changed:
   - `pnpm generate:types` and make sure `src/payload-types.ts` is staged
   - check `src/migrations/` has a migration for the change; if not, tell the user to run `pnpm migrate:create <name>` (needs the local DB) — do not skip this silently.
3. If `src/features/**/service.ts` or collections changed: `pnpm test:int`.
4. `node scripts/risk-tier.mjs` — note the tier and the High files.
5. **Review in a fresh context.** Run the `reviewer` subagent (it follows `REVIEW.md`). Fix every Important finding,
   or answer it in one line in the PR. From round 2 pass it the SHA of the last reviewed commit, so it reviews only
   the new diff. **Stop after 3 rounds** that still have Important findings: don't commit — tell the user the approach
   needs rethinking and what kept coming back.
6. If the same kind of finding has come up before, fix it at the source instead of once more: a line in `REVIEW.md`,
   `AGENTS.md`, a lint rule or a test (say which in the commit body).
7. Review `git diff` once more for debug logs, secrets, commented-out code.
8. Commit with a conventional message (split unrelated changes into separate commits) and `git push -u origin <current-branch>`.
9. Print a summary: what shipped, how it was verified (commands + result), risk tier, reviewer rounds and last
   result, follow-ups. If the tier is High, add: "High-risk — you need to read the diff of <files> and add the
   sign-off line to the PR." Never write that line yourself.

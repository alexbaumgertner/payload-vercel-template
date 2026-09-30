---
name: ship
description: Verify, commit and push the current work. Use when the user runs /ship.
disable-model-invocation: true
---

# /ship

1. `pnpm check` — fix failures and re-run until green.
2. If files in `src/collections/` or `src/payload.config.ts` changed:
   - `pnpm generate:types` and make sure `src/payload-types.ts` is staged
   - check `src/migrations/` has a migration for the change; if not, tell the user to run `pnpm migrate:create <name>` (needs the local DB) — do not skip this silently.
3. If `src/features/**/service.ts` or collections changed: `pnpm test:int`.
4. Review `git diff` once more for debug logs, secrets, commented-out code.
5. Commit with a conventional message (split unrelated changes into separate commits) and `git push -u origin <current-branch>`.
6. Print a 3-line summary: what shipped, how it was verified, follow-ups.

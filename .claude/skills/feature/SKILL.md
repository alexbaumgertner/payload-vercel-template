---
name: feature
description: Story-first workflow for a new user-facing feature — story, approval, failing tests, implementation, browser check, review. Use when the user runs /feature or asks to build a feature end to end.
disable-model-invocation: true
---

# /feature <what to build>

1. **Story** — explore read-only (collections, features, components involved; `docs/product.md`, `docs/decisions.md`),
   then write `docs/stories/NNN-slug.md` from `docs/stories/_template.md` (next free number, `status: draft`):
   - As a / I want / so that, using a role from `docs/product.md`
   - acceptance criteria as Given/When/Then, each tagged `[happy]` or `[edge]`; cover empty / too-long input,
     unauthorized, rate-limited, non-default locale, double submit and third-party failure where they apply
   - out of scope; data model changes flagged explicitly (they need a migration); files to touch
2. **Stop for approval.** Show the story and wait. Edit it until approved, then set `status: approved`.
3. **Failing tests** — one or more tests per criterion, named after the behavior, at the cheapest layer that proves it
   (unit → browser → int → e2e). Run them and confirm they fail for the right reason. Fill the story's Verification table.
4. **Implement** (`status: in-progress`) following `AGENTS.md` and the nested `AGENTS.md` files (`src/collections`, `src/features`, `src/components`, `tests`).
   Order: collection → `pnpm generate:types` → service → action → UI. Make the tests pass without weakening them.
5. **Verify in the browser** — open the page with the Chrome DevTools MCP (or Playwright MCP) at desktop and 360px:
   golden path, each `[edge]` that has UI, console free of errors. Then `pnpm check`, `pnpm test:int`, `pnpm test:e2e`.
6. **Review** — run the `reviewer` subagent on the diff; fix blockers and should-fixes.
7. **Done** — set the story to `status: done`, update `docs/baseline.md` if a baseline area changed, and report:
   what changed, which tests prove each criterion, anything left for the human (`pnpm migrate:create`, env vars).

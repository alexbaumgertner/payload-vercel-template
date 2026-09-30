---
name: feature
description: Plan-then-build workflow for a new feature. Use when the user runs /feature or asks to build a feature end to end.
disable-model-invocation: true
---

# /feature <what to build>

1. **Explore** (read-only): find the collections, features and components involved. Read `docs/decisions.md` and `docs/product.md` if the change touches product behavior.
2. **Plan** — write a short plan and STOP for approval:
   - user-visible outcome (1–2 sentences)
   - data model changes (collections/fields/access) — flag them explicitly, they need a migration
   - files to create/change
   - tests to add (unit / int / e2e)
   - out of scope
3. **Implement** after approval, following `AGENTS.md` and the scoped rules. Order: schema/collection → `pnpm generate:types` → service + int test → action → UI → e2e.
4. **Verify**: `pnpm check`, `pnpm test:int`; for UI open the page in the browser (desktop + 360px) and run the relevant e2e spec.
5. **Report**: what changed, how it was verified, anything left for the human (e.g. `pnpm migrate:create`, new env vars).

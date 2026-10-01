---
name: new-collection
description: Scaffold a new Payload collection with access control, types, migration and tests. Use when the user runs /new-collection.
disable-model-invocation: true
---

# /new-collection <slug> <short description of fields>

1. Create `src/collections/<PascalName>.ts` following `src/collections/AGENTS.md`
   (explicit access for all operations, `useAsTitle`, `defaultColumns`, indexes on filter/sort fields).
2. Register it in `src/payload.config.ts` `collections` array.
3. `pnpm generate:types`.
4. If the site reads it: add `src/features/<name>/queries.ts` with `overrideAccess: false`, and mark visitor-facing
   text fields `localized: true` (queries pass `locale` + `fallbackLocale: defaultLocale`).
5. Add `tests/int/<name>.int.spec.ts` covering at least: anonymous access is what we intend, and one happy-path create/read.
6. `pnpm check && pnpm test:int`.
7. Remind the user: `pnpm migrate:create add-<slug>` before merge.

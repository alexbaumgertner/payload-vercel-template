# Public site

Follow the UI rules in `src/components/AGENTS.md` (components, CSS Modules, copy, 360px).

- Pages live in `[locale]/(site)/`. Don't add `loading.tsx` next to the catch-all `[locale]/[...rest]`:
  streaming would turn unknown pages into HTTP 200 instead of 404.
- New public pages: add them to the list in `tests/e2e/devtools.e2e.spec.ts`.

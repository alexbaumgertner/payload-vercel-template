# UI: React components and CSS Modules

Applies to `src/components/`, `src/app/(frontend)/` and `messages/`.

- Server Components by default. Add `'use client'` only for state, effects or event handlers, and keep client components leaf-sized.
- Component = folder `src/components/Name/` with `Name.tsx` + `Name.module.css`; named export.
- Styles: CSS Modules only, camelCase class names, design tokens from `src/app/(frontend)/globals.css`
  (`var(--color-*)`, `var(--radius-*)`, `var(--space-page)`). Add a token instead of hard-coding a new color.
- Dark mode comes from `prefers-color-scheme` tokens — never branch on theme in JS.
- Mobile first: must work at 360px; use `clamp()` for type scale and `min()` in grid tracks.
- Accessibility: semantic elements, labelled inputs, visible `:focus-visible`; one `<main>` and one `h1` per page.
  `tests/e2e/a11y.e2e.spec.ts` runs axe on every page in `tests/helpers/public-pages.ts` (light and dark, desktop and
  mobile) and fails on `serious`/`critical` — add new public pages there.
  - Long-running work (uploads, generation, anything that finishes after the user stops watching) announces completion
    through an `aria-live="polite"` region that is in the DOM, empty, from the first render; a region inserted together
    with its text is announced unreliably. Errors use `role="alert"`. A result that merely appears on screen is silent.
  - Text that repeats in every row or cell (e.g. «edit», «own», «add») is an icon with an `aria-label` (or `<title>`),
    not a visible word; the word stays in `messages/*` for assistive tech.
  - An accessible name contains the visible text, starting with it (WCAG 2.5.3): `EN` + visually hidden "English",
    not `aria-label="English"` on a link that shows `EN`.
  - Contrast ≥ 4.5:1 for normal text in both themes; take colours from tokens (`--color-button`/`--color-on-button`,
    `--color-*-strong` for small text on tinted backgrounds) instead of `#fff` on an accent.
- Forms: `useActionState` + Server Action; disable controls while pending.
- Copy: no inline strings. Add keys to `messages/en.json` and `messages/ru.json`; read them with
  `useTranslations` (client) or `getTranslations({ locale, namespace })` (server). Internal links use `Link` from `@/i18n/navigation`;
  `/admin` stays a plain `<a>`. Check the Russian layout at 360px — it runs ~20% longer.

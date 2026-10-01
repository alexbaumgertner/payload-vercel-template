# Tests

Applies to `tests/`, `vitest.config.mts` and `playwright.config.ts`.

- Unit (`tests/unit/*.unit.spec.ts`, jsdom): Zod schemas, pure helpers, small client components. No database.
- Browser (`tests/browser/*.browser.spec.tsx`, Vitest Browser Mode in real Chromium via Playwright): interactive client
  components — forms, focus, pending/error states. Render with `vitest-browser-react`, query with `page` and assert with
  `expect.element` from `vitest/browser`; `vi.mock` the `@/features/*/actions` module and return `LoginState`/`WaitlistState`.
  Never import Payload or server-only code here (`@/lib/payload` is stubbed in this project).
- Integration (`tests/int/*.int.spec.ts`, node): services and collection access via the Payload Local API against the
  `app_test` database (set in `tests/helpers/int-setup.ts`). Clean up the collections you touch; call `payload.destroy()` in `afterAll`.
  Pass `context: { disableRevalidate: true }` when creating docs whose hooks revalidate.
- E2E (`tests/e2e/*.e2e.spec.ts`): real user flows and cross-cutting guarantees (auth, i18n, security headers,
  monitoring/analytics off by default). Use role/label locators, relative URLs (baseURL is configured), unique emails
  per run/project. Runs on desktop and mobile projects. Sign in with `tests/helpers/login.ts`.
  `devtools.e2e.spec.ts` uses CDP (`page.context().newCDPSession(page)`) for console-error checks, throttling and CLS —
  add new public pages to its list.
- Debugging a UI bug interactively: use the `chrome-devtools` MCP (console, network, performance trace, Lighthouse)
  against `http://localhost:3000`, then lock the fix in with a browser or e2e test.
- A bug fix starts with a failing test that reproduces it.

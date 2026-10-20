# Tests

Applies to `tests/`, `vitest.config.mts` and `playwright.config.ts`.

- Unit (`tests/unit/*.unit.spec.ts`, jsdom): Zod schemas, pure helpers, small client components. No database.
- Browser (`tests/browser/*.browser.spec.tsx`, Vitest Browser Mode in real Chromium via Playwright): interactive client
  components — forms, focus, pending/error states. Render with `vitest-browser-react`, query with `page` and assert with
  `expect.element` from `vitest/browser`; `vi.mock` the `@/features/*/actions` module and return `LoginState`/`WaitlistState`.
  Never import Payload or server-only code here (`@/lib/payload` and bare `payload` are stubbed in this project, so a
  service importing a runtime value such as `APIError` cannot break the dependency optimizer on a cold CI cache).
- Integration (`tests/int/*.int.spec.ts`, node): services and collection access via the Payload Local API against the
  `app_test` database (set in `tests/helpers/int-setup.ts`). Clean up the collections you touch; call `payload.destroy()` in `afterAll`.
  Pass `context: { disableRevalidate: true }` when creating docs whose hooks revalidate.
- E2E (`tests/e2e/*.e2e.spec.ts`): real user flows and cross-cutting guarantees (auth, i18n, security headers,
  monitoring/analytics off by default). Use role/label locators, relative URLs (baseURL is configured), unique emails
  per run/project. Runs on desktop and mobile projects. Sign in with `tests/helpers/login.ts`. Shared demo content
  (`scripts/seed-demo.ts`) is seeded once by `tests/helpers/e2e-setup.ts` (`globalSetup`) — add rows several specs read
  there instead of seeding the same rows from parallel workers.
  `devtools.e2e.spec.ts` uses CDP (`page.context().newCDPSession(page)`) for console-error checks, throttling and CLS;
  `a11y.e2e.spec.ts` runs axe (serious/critical, light + dark) and landmark checks. Both visit
  `tests/helpers/public-pages.ts` — add every new public page there.
- Debugging a UI bug interactively: use the `chrome-devtools` MCP (console, network, performance trace, Lighthouse)
  against `http://localhost:3000`, then lock the fix in with a browser or e2e test.
- A bug fix starts with a failing test that reproduces it.

## Lessons (from this template's sibling projects)

- **Break the guard.** For every safety check you add — guard rule, env gate, access rule, migration test — break the
  code it protects, watch the test go red, restore, and say so in the commit body. A test that passes against broken
  code is worse than none: it certifies the bug. (A schema test compared against a push-built database passed with
  the fix removed; push had mended the schema behind it.)
- **Env-dependent helpers take `env` as a parameter** — `cronAuthorized(request, env)`, `mailRefusal(kind, env)` /
  `sendMail(…, env = process.env)`, `shouldPushSchema(requested, env)`, `isolateTestEnv(env)` — so tests pass a plain
  object instead of mutating `process.env`. Only entry points (`src/lib/env.ts`, route handlers, setup files) read
  `process.env`. Where a module reads it at import, use `vi.stubEnv` + `vi.unstubAllEnvs()` in `afterEach`, never assignment.
- **E2E is part of "done".** `pnpm check` is not enough: run `pnpm test:e2e` (and `test:int`) before calling a task
  finished. A red spec is a bug report until proven otherwise — fix the code or the spec in the same PR; never skip
  it, loosen it or retry it green. (Three e2e specs in a sibling project stayed red for a week unnoticed; a fourth was
  catching a real bug.)

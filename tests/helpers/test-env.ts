/**
 * Keeps test processes away from real services and real data. Takes the env object as a
 * parameter (like `cronAuthorized` / `sendMail`) so the unit test passes a plain object instead
 * of mutating `process.env`. Callers: `tests/helpers/int-setup.ts`, `playwright.config.ts`.
 */

type Env = Record<string, string | undefined>

export const DEFAULT_TEST_DATABASE_URL = 'postgresql://app:app@127.0.0.1:5432/app_test'

/**
 * Keys that would make a test talk to a live third party. With `RESEND_API_KEY` in a local `.env`,
 * every login test would email a real (if fake-looking) address; without it the code is printed
 * to the console, which is what the int tests and e2e helpers expect.
 */
export const LIVE_SERVICE_KEYS = ['RESEND_API_KEY'] as const

/** Every test process (int workers, Playwright runner/workers and the dev server it starts). */
export function isolateTestEnv(env: Env): void {
  for (const key of LIVE_SERVICE_KEYS) delete env[key]
}

/**
 * Integration tests must never touch the dev or production database. `DATABASE_URI` and
 * `POSTGRES_URL` would win over / stand in for `DATABASE_URL` (src/lib/database-url.ts), so they go.
 */
export function pointAtTestDatabase(env: Env): void {
  delete env.DATABASE_URI
  delete env.POSTGRES_URL
  env.DATABASE_URL = env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL
}

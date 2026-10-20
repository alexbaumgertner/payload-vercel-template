import { createHash } from 'node:crypto'

/**
 * Which connection string the app uses, and a log line that shows it.
 *
 * Why the order matters: the Neon integration on Vercel creates a database branch per preview
 * deployment and puts it into `DATABASE_URL`, while `POSTGRES_URL` can still point at production.
 * Reading `POSTGRES_URL` first would make a preview write into production silently — nothing
 * fails, the data is just wrong. So: `DATABASE_URI` (set by hand) → `DATABASE_URL` (the preview
 * branch) → `POSTGRES_URL` (shared, from the integration). The chosen source and host are logged
 * once, so a mistake shows up in the build log rather than in the data a week later.
 *
 * Framework-free (no `server-only`, no `next/*`): `src/lib/env.ts` and the Payload CLI use it.
 */

type Env = Record<string, string | undefined>

export const DATABASE_URL_SOURCES = ['DATABASE_URI', 'DATABASE_URL', 'POSTGRES_URL'] as const
export type DatabaseUrlSource = (typeof DATABASE_URL_SOURCES)[number]

export function selectDatabaseUrl(env: Env): { source: DatabaseUrlSource; url: string } | null {
  for (const source of DATABASE_URL_SOURCES) {
    const value = env[source]?.trim()
    if (value) return { source, url: withStrictSsl(value) }
  }
  return null
}

/**
 * Explicit `sslmode=verify-full`. Neon hands out `sslmode=require`, which `pg` currently treats
 * as `verify-full` (checks the chain and the host name) — but it warns that the next major
 * switches `require` to libpq semantics, where the certificate is not checked at all: still
 * encrypted, no protection against a spoofed host. Writing down what already happens keeps the
 * behaviour independent of the driver version and silences the warning. `prefer` and
 * `verify-ca` get the same treatment and the same warning from the driver.
 *
 * A URL without `sslmode` (local Postgres, no TLS) is left alone: there is no certificate to check.
 * An unparsable string is left alone too, so it fails loudly where it is used.
 */
const WEAKER_SSL_MODES = new Set(['prefer', 'require', 'verify-ca'])

export function withStrictSsl(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    const mode = url.searchParams.get('sslmode')
    if (!mode || !WEAKER_SSL_MODES.has(mode)) return connectionString
    url.searchParams.set('sslmode', 'verify-full')
    return url.toString()
  } catch {
    return connectionString
  }
}

/**
 * Host + database name and a short fingerprint of the host; never the user or password.
 * Vercel redacts values that look like secrets from logs, and a database host often becomes
 * `[REDACTED]`. The fingerprint does not look like a secret and survives: compare it between the
 * production and a preview deployment — equal means the preview writes into production.
 */
export function describeDatabase(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    const fingerprint = createHash('sha256').update(url.hostname).digest('hex').slice(0, 8)
    return `${url.hostname}${url.pathname} · fingerprint ${fingerprint}`
  } catch {
    return 'unparsable connection string'
  }
}

let announced = false

/** One log line per process, not one per connection. */
export function announceDatabase(env: Env = process.env): void {
  if (announced) return
  const selected = selectDatabaseUrl(env)
  if (!selected) return
  announced = true
  console.info(`[db] using ${selected.source}: ${describeDatabase(selected.url)}`)
}

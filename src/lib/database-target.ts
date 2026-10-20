/**
 * Keeps local tooling away from managed (production) databases.
 *
 * `next dev` pushes Payload schema changes automatically, and `pnpm seed` / `pnpm create-admin`
 * write rows. Both must hit a local Postgres unless someone deliberately says otherwise — the
 * classic accident is `vercel env pull` writing the production `DATABASE_URL` into a local env
 * file, followed by `pnpm dev` pushing the dev schema into Neon.
 *
 * Framework-free (no `server-only`, no `next/*`): `payload.config.ts` and the CLI scripts use it.
 * Pass the env object explicitly; `DATABASE_URL` must already be the resolved URL (`env.ts`).
 */

type Env = Record<string, string | undefined>

// Loopback plus the usual docker-compose / dev-container service names.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'host.docker.internal'])

function databaseHost(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^\[|\]$/g, '')
  } catch {
    return null
  }
}

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  const host = databaseHost(url)
  return host !== null && LOCAL_HOSTS.has(host)
}

/** Any Vercel build or function. Vercel sets `VERCEL=1` in both, locally it is unset. */
const onVercel = (env: Env) => env.VERCEL === '1' || Boolean(env.VERCEL_ENV)

/**
 * Payload's dev push runs only against a local database, and never in production. There is no
 * opt-in for a remote push: remote schemas change through committed migrations only.
 * `ALLOW_REMOTE_DATABASE` lets a process *connect* to a remote database, not push to it.
 */
export function shouldPushSchema(requested: boolean, env: Env): boolean {
  return requested && env.NODE_ENV !== 'production' && isLocalDatabaseUrl(env.DATABASE_URL)
}

/**
 * Called when the Payload config loads (dev server, CLI, scripts, tests). Outside Vercel a remote
 * database is refused unless `ALLOW_REMOTE_DATABASE=1` is set for that one command. Vercel builds
 * (`payload migrate`) and functions are exempt — that is where the remote database belongs.
 * `NODE_ENV=production` alone is not an exemption: some shells export it globally.
 */
export function assertDevDatabaseIsLocal(env: Env): void {
  if (onVercel(env)) return
  if (isLocalDatabaseUrl(env.DATABASE_URL) || env.ALLOW_REMOTE_DATABASE === '1') return
  const host = databaseHost(env.DATABASE_URL) ?? 'unknown host'
  throw new Error(
    `Refusing to start against remote database ${host} outside Vercel. ` +
      'Point DATABASE_URL at a local Postgres (.env.development.local, docker compose up -d), or set ' +
      'ALLOW_REMOTE_DATABASE=1 for this one command if you really mean it.',
  )
}

/** One-off scripts that write data (`create-admin`, `backup:restore`): local unless opted in. */
export function assertLocalDatabaseForScript(scriptName: string, env: Env): void {
  if (isLocalDatabaseUrl(env.DATABASE_URL) || env.ALLOW_REMOTE_DATABASE === '1') return
  const host = databaseHost(env.DATABASE_URL) ?? 'unknown host'
  throw new Error(
    `${scriptName} refuses to run against remote database ${host}. ` +
      'Point DATABASE_URL at a local Postgres, or set ALLOW_REMOTE_DATABASE=1 for this one command ' +
      '(see docs/runbooks/production-admin.md).',
  )
}

/**
 * `pnpm seed` writes demo rows and a demo admin, so it fails closed: it runs on a Vercel
 * Preview build (a throwaway Neon branch) or against a database on this machine. Production,
 * any other Vercel environment, or an unknown remote host are refused, with no override —
 * demo data has no business in production.
 */
export function canSeed(env: Env): boolean {
  if (env.VERCEL_ENV === 'preview') return true
  if (onVercel(env)) return false
  return isLocalDatabaseUrl(env.DATABASE_URL)
}

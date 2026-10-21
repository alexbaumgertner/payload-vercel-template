import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Who may call a cron route. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 *
 * Fails closed: on any Vercel deployment a missing secret is a misconfiguration and denies. The
 * opposite (`!secret || header matches`) looks harmless while production has the secret — but
 * previews usually don't get it, and a preview's database is a branch of production with real
 * people's data. A backup route there would hand that data to anyone who finds the URL. Vercel's
 * deployment protection hides previews today, but it is one checkbox away; the route must defend
 * itself. Only local runs (no `VERCEL_ENV`) are open without a secret.
 *
 * Both sides are hashed before `timingSafeEqual`, so the comparison takes the same time whatever
 * the header length or content.
 */
export function cronAuthorized(request: Request, env: Record<string, string | undefined>): boolean {
  const secret = env.CRON_SECRET?.trim()
  if (!secret) return !env.VERCEL_ENV
  const header = request.headers.get('authorization') ?? ''
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`))
}

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()

import crypto from 'node:crypto'

/**
 * Signed session cookie issued after a successful email-code login.
 * Framework-free: the Payload auth strategy reads it outside a Next.js request too.
 */

export const SESSION_COOKIE = 'indie_session'
/** Short-lived on purpose: a stolen laptop should not mean a month of admin access. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

function sign(body: string, secret: string): string {
  const key = crypto.createHash('sha256').update(`indie-session:${secret}`).digest()
  return crypto.createHmac('sha256', key).update(body).digest('base64url')
}

/** Constant-time compare that leaks neither length nor first mismatch. */
function safeEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest()
  const hashB = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(hashA, hashB)
}

export function issueToken(
  userId: string | number,
  secret: string,
  now: number = Date.now(),
): { token: string; maxAge: number } {
  if (!secret) throw new Error('Session secret is empty; refusing to sign sessions')
  const exp = Math.floor(now / 1000) + SESSION_TTL_SECONDS
  const body = `${userId}.${exp}`
  return { token: `${body}.${sign(body, secret)}`, maxAge: SESSION_TTL_SECONDS }
}

/** User id from a valid, unexpired token; otherwise null. */
export function readToken(
  token: string | undefined,
  secret: string,
  now: number = Date.now(),
): string | null {
  if (!token || !secret) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, exp, signature] = parts as [string, string, string]
  if (!/^\d+$/.test(userId) || !/^\d+$/.test(exp)) return null
  if (Number(exp) * 1000 < now) return null
  return safeEqual(signature, sign(`${userId}.${exp}`, secret)) ? userId : null
}

export function readSessionCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined
  const raw = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1)
  return raw ? decodeURIComponent(raw) : undefined
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

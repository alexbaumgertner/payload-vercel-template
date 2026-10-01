/**
 * Security headers for every route (public site, Payload admin and API).
 * Framework-free so `next.config.ts` and unit tests can import it.
 *
 * The CSP ships as Report-Only: violations show up in the browser console (and fail the
 * e2e CSP check) without breaking anything. `frame-ancestors` is ignored in Report-Only,
 * so clickjacking protection is enforced separately.
 */

type Header = { key: string; value: string }

const BLOB_STORAGE = 'https://*.public.blob.vercel-storage.com'
const GRAVATAR = 'https://www.gravatar.com'

export function contentSecurityPolicy({ isDev }: { isDev: boolean }): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // Next.js inlines bootstrap scripts; dev mode (React Refresh) also needs eval.
    'script-src': ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // Payload admin and next/font inject inline styles.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', BLOB_STORAGE, GRAVATAR],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(isDev ? ['ws:', 'wss:'] : [])],
    'media-src': ["'self'", 'blob:', BLOB_STORAGE],
    'frame-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'"],
  }
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

export function securityHeaders({ isDev }: { isDev: boolean }): Header[] {
  return [
    { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy({ isDev }) },
    // Enforced: only same-origin framing (Payload live preview embeds the site in the admin).
    { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    // No `preload`: that is a one-way commitment for every subdomain — opt in per product.
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    },
  ]
}

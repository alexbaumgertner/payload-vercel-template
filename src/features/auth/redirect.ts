const PROBE_ORIGIN = 'http://same-origin.invalid'
export const DEFAULT_REDIRECT = '/admin'

/**
 * Only same-origin paths, so the login form can't be turned into an open redirect.
 * Parsed with the URL parser instead of prefix checks: browsers treat `/\evil.com`
 * like `//evil.com`, and tabs/newlines inside the scheme are stripped.
 */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return DEFAULT_REDIRECT
  try {
    const url = new URL(value, PROBE_ORIGIN)
    if (url.origin !== PROBE_ORIGIN) return DEFAULT_REDIRECT
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_REDIRECT
  }
}

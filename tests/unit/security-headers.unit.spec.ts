import { describe, expect, it } from 'vitest'

import { contentSecurityPolicy, securityHeaders } from '@/lib/security-headers'

const header = (isDev: boolean, key: string) =>
  securityHeaders({ isDev }).find((h) => h.key === key)?.value

describe('security headers', () => {
  it('production CSP allows neither eval nor websockets', () => {
    const csp = contentSecurityPolicy({ isDev: false })
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).not.toMatch(/\bwss?:/)
  })

  it('production CSP loads scripts only from the site itself', () => {
    const scriptSrc = contentSecurityPolicy({ isDev: false })
      .split('; ')
      .find((directive) => directive.startsWith('script-src'))
    expect(scriptSrc).toBe("script-src 'self' 'unsafe-inline'")
  })

  it('dev CSP allows eval and the HMR websocket', () => {
    const csp = contentSecurityPolicy({ isDev: true })
    expect(csp).toContain("'unsafe-eval'")
    expect(csp).toContain('ws:')
  })

  it('blocks plugins, foreign base URIs and cross-origin form posts', () => {
    const csp = contentSecurityPolicy({ isDev: false })
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
  })

  it('enforces frame-ancestors outside Report-Only, where browsers ignore it', () => {
    expect(header(false, 'Content-Security-Policy')).toBe("frame-ancestors 'self'")
    expect(header(false, 'X-Frame-Options')).toBe('SAMEORIGIN')
  })

  it('keeps the main CSP in Report-Only until violations are reviewed', () => {
    expect(header(false, 'Content-Security-Policy-Report-Only')).toContain("default-src 'self'")
  })

  it('sends HSTS without preload', () => {
    const hsts = header(false, 'Strict-Transport-Security')
    expect(hsts).toMatch(/max-age=\d{8,}/)
    expect(hsts).not.toContain('preload')
  })
})

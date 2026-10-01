import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

type Violation = { directive: string; blocked: string; source: string }

/** Report-Only violations don't break the page, so collect them from the DOM event. */
async function recordCspViolations(page: Page) {
  await page.addInitScript(() => {
    const list: Array<{ directive: string; blocked: string; source: string }> = []
    ;(window as unknown as { __csp: typeof list }).__csp = list
    document.addEventListener('securitypolicyviolation', (event) => {
      list.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
        source: event.sourceFile,
      })
    })
  })
  return () => page.evaluate(() => (window as unknown as { __csp: Violation[] }).__csp)
}

test('every response carries the security headers', async ({ request }) => {
  for (const path of ['/', '/changelog', '/admin/login', '/api/changelog']) {
    const headers = (await request.get(path)).headers()
    expect(headers['content-security-policy-report-only'], path).toContain("default-src 'self'")
    expect(headers['content-security-policy'], path).toBe("frame-ancestors 'self'")
    expect(headers['x-frame-options'], path).toBe('SAMEORIGIN')
    expect(headers['strict-transport-security'], path).toContain('max-age=')
    expect(headers['x-content-type-options'], path).toBe('nosniff')
    expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin')
    expect(headers['permissions-policy'], path).toContain('camera=()')
    expect(headers['x-powered-by'], path).toBeUndefined()
  }
})

for (const path of ['/', '/changelog', '/admin/login']) {
  test(`${path} has no CSP violations`, async ({ page }) => {
    const violations = await recordCspViolations(page)
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    expect(await violations()).toEqual([])
  })
}

test('the signed-in admin and rich-text editor have no CSP violations', async ({
  page,
}, testInfo) => {
  const suffix = `csp-${testInfo.project.name}`
  const email = await seedTestUser(suffix)
  try {
    const violations = await recordCspViolations(page)
    await login({ page, email })
    await page.goto('/admin/collections/changelog/create')
    await expect(page.locator('[data-lexical-editor="true"]').first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(await violations()).toEqual([])
  } finally {
    await cleanupTestUser(suffix)
  }
})

import { expect, test } from '@playwright/test'

// The suite runs without SENTRY_DSN, like a fresh clone of the template.
test.describe('without SENTRY_DSN', () => {
  test('pages load no Sentry SDK and send nothing to Sentry', async ({ page }, testInfo) => {
    const sentryRequests: string[] = []
    page.on('request', (request) => {
      if (/sentry|\/monitoring/i.test(request.url())) sentryRequests.push(request.url())
    })

    await page.goto('/')
    await page
      .getByPlaceholder('you@company.com')
      .fill(`monitoring-${testInfo.project.name}-${Date.now()}@example.com`)
    await page.getByRole('button', { name: 'Join the waitlist' }).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText("You're on the list")
    await page.goto('/changelog')
    await page.waitForLoadState('networkidle')

    expect(await page.evaluate(() => '__SENTRY__' in globalThis)).toBe(false)
    expect(sentryRequests).toEqual([])
  })

  test('there is no tunnel route', async ({ request }) => {
    const response = await request.post('/monitoring', { data: 'x' })
    expect(response.status()).toBe(404)
  })
})

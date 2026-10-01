import { expect, test } from '@playwright/test'

// The suite runs with the default ANALYTICS_PROVIDER=none.
test('without an analytics provider, pages load no tracker and send no events', async ({
  page,
}, testInfo) => {
  const beacons: string[] = []
  page.on('request', (request) => {
    if (/_vercel\/insights|vercel-scripts\.com/.test(request.url())) beacons.push(request.url())
  })

  await page.goto('/')
  await page
    .getByPlaceholder('you@company.com')
    .fill(`analytics-${testInfo.project.name}-${Date.now()}@example.com`)
  await page.getByRole('button', { name: 'Join the waitlist' }).click()
  await expect(page.getByRole('main').getByRole('status')).toContainText("You're on the list")
  await page.goto('/changelog')
  await page.waitForLoadState('networkidle')

  expect(await page.evaluate(() => 'va' in window)).toBe(false)
  expect(beacons).toEqual([])
})

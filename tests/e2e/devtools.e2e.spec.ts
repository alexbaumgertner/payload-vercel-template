import { expect, test, type Page } from '@playwright/test'

test.skip(({ browserName }) => browserName !== 'chromium', 'CDP is Chromium-only')

function collectProblems(page: Page) {
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console.error: ${message.text()}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`)
  })
  return problems
}

for (const path of ['/', '/changelog']) {
  test(`${path} has no console errors or server failures`, async ({ page }) => {
    const problems = collectProblems(page)
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    expect(problems).toEqual([])
  })
}

test('landing stays usable on a throttled phone connection', async ({ page }, testInfo) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await cdp.send('Performance.enable')

  await page.addInitScript(() => {
    const vitals = { cls: 0 }
    ;(window as unknown as { __vitals: typeof vitals }).__vitals = vitals
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { value: number; hadRecentInput: boolean }
      >) {
        if (!entry.hadRecentInput) vitals.cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByPlaceholder('you@company.com').fill('not-an-email')
  await page.getByRole('button', { name: 'Join the waitlist' }).click()
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Enter a valid email address.')

  const cls = await page.evaluate(
    () => (window as unknown as { __vitals: { cls: number } }).__vitals.cls,
  )
  const { metrics } = await cdp.send('Performance.getMetrics')
  await testInfo.attach('cdp-metrics.json', {
    body: JSON.stringify({ cls, metrics }, null, 2),
    contentType: 'application/json',
  })

  expect(cls).toBeLessThan(0.1)
})

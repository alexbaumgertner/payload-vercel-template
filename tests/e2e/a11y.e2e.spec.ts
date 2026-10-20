import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

import { publicPages } from '../helpers/public-pages'

/**
 * Automated accessibility floor for every public page, on desktop and mobile (both projects).
 * axe catches what can be computed (contrast, names, roles, ARIA misuse); it fails here only on
 * `serious` and `critical` impact — `minor`/`moderate` are attached to the report, not enforced.
 * The landmark checks cover what Lighthouse once flagged in a sibling project as the only failure:
 * without one `<main>`, screen-reader users can't skip the header on every page.
 * What neither catches — announcements of async results, focus order — is covered by the
 * component tests and the rules in src/components/AGENTS.md.
 */

const BLOCKING = new Set(['serious', 'critical'])

async function blockingViolations(page: Page, testInfo: TestInfo) {
  // Next's dev-only overlay/indicator is not part of the product.
  const results = await new AxeBuilder({ page }).exclude('nextjs-portal').analyze()
  await testInfo.attach('axe-results.json', {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  })
  return results.violations
    .filter((violation) => BLOCKING.has(violation.impact ?? ''))
    .map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      targets: nodes.map((node) => node.target.join(' ')),
    }))
}

for (const path of publicPages) {
  test.describe(path, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    })

    test('has no serious or critical axe violations', async ({ page }, testInfo) => {
      expect(await blockingViolations(page, testInfo)).toEqual([])
    })

    test('has no serious or critical axe violations in dark mode', async ({ page }, testInfo) => {
      // Colours come from prefers-color-scheme tokens; contrast must hold in both themes.
      await page.emulateMedia({ colorScheme: 'dark' })
      expect(await blockingViolations(page, testInfo)).toEqual([])
    })

    test('has one <main>, one h1 and a page language', async ({ page }) => {
      await expect(page.locator('main')).toHaveCount(1)
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.locator('html')).toHaveAttribute('lang', /^[a-z]{2}/)
    })
  })
}

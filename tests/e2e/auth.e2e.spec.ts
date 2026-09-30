import { expect, test } from '@playwright/test'

import { clearTestLoginCodes, login, requestCodeInUi } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

test.describe('Email-code login', () => {
  test.beforeAll(async () => {
    await clearTestLoginCodes()
  })

  test('login page asks for an email and has no password field', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send login code' })).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })

  test('password login is disabled on the API', async ({ request }) => {
    const res = await request.post('/api/users/login', {
      data: { email: 'someone@example.com', password: 'anything' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('unknown addresses get the same answer as real ones', async ({ page }, testInfo) => {
    await requestCodeInUi(page, `unknown-${testInfo.project.name}-${Date.now()}@example.com`)
    await expect(page.getByText(/If .* has an account, a 6-digit code is on its way/)).toBeVisible()
  })

  test('a wrong code is rejected', async ({ page }, testInfo) => {
    await requestCodeInUi(page, `wrong-${testInfo.project.name}@example.com`)
    await page.getByLabel('Code').fill('000000')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(
      page.getByRole('alert').filter({ hasText: 'The code is wrong or has expired.' }),
    ).toBeVisible()
  })

  test('signs in with a code and logs out', async ({ page }, testInfo) => {
    const suffix = `flow-${testInfo.project.name}`
    const email = await seedTestUser(suffix)
    try {
      await login({ page, email })

      const logout = page.getByRole('button', { name: 'Log out' })
      if (!(await logout.isVisible())) {
        // Payload renders separate desktop and mobile nav togglers; only one is visible.
        await page.getByRole('button', { name: 'Open Menu' }).filter({ visible: true }).click()
      }
      await logout.click()
      await page.waitForURL(/\/admin\/login/)

      await page.goto('/admin')
      await expect(page).toHaveURL(/\/admin\/login/)
    } finally {
      await cleanupTestUser(suffix)
    }
  })
})

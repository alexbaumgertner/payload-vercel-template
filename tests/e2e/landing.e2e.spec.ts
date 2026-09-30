import { expect, test } from '@playwright/test'

test.describe('Landing page', () => {
  test('shows the hero and features', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /everything a solo founder needs/i }),
    ).toBeVisible()
  })

  test('rejects an invalid email without leaving the page', async ({ page }) => {
    await page.goto('/')

    await page.getByPlaceholder('you@company.com').fill('not-an-email')
    await page.getByRole('button', { name: 'Join the waitlist' }).click()

    await expect(page.getByRole('alert')).toHaveText('Enter a valid email address.')
  })

  test('joins the waitlist with a valid email', async ({ page }, testInfo) => {
    await page.goto('/')

    const email = `e2e-${testInfo.project.name}-${Date.now()}@example.com`
    await page.getByPlaceholder('you@company.com').fill(email)
    await page.getByRole('button', { name: 'Join the waitlist' }).click()

    await expect(page.getByRole('status')).toContainText("You're on the list")
  })
})

test('changelog page renders', async ({ page }) => {
  await page.goto('/changelog')
  await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible()
})

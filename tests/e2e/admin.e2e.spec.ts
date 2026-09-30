import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin panel', () => {
  test.describe.configure({ mode: 'serial' })

  let page: Page

  test.beforeAll(async ({ browser }, testInfo) => {
    await seedTestUser(testInfo.project.name)
    page = await (await browser.newContext()).newPage()
    await login({ page, user: testUser(testInfo.project.name) })
  })

  test.afterAll(async ({}, testInfo) => {
    await cleanupTestUser(testInfo.project.name)
  })

  test('lists waitlist signups', async () => {
    await page.goto('/admin/collections/waitlist-signups')
    await expect(page.locator('h1', { hasText: 'Waitlist' }).first()).toBeVisible()
  })

  test('opens the changelog editor', async () => {
    await page.goto('/admin/collections/changelog/create')
    await expect(page.locator('input[name="title"]')).toBeVisible()
  })
})

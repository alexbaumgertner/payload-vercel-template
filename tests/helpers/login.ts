import { expect, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import { requestCode } from '../../src/features/auth/otp'
import { payloadOtpStore } from '../../src/features/auth/store'
import config from '../../src/payload.config'

export const E2E_CODE = '424242'

/** Rate-limit rows from earlier runs would otherwise lock the tests out for an hour. */
export async function clearTestLoginCodes(): Promise<void> {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'auth-codes',
    where: { email: { like: '@example.com' } },
  })
}

/**
 * The dev server emails (or logs) a random code we can't read, so issue a newer code
 * with a known value through the same store; verification only accepts the latest one.
 */
export async function issueKnownCode(email: string): Promise<void> {
  const payload = await getPayload({ config })
  const result = await requestCode(email, 'e2e-helper', {
    store: payloadOtpStore(payload),
    secret: payload.secret,
    minResponseMs: 0,
    generateCode: () => E2E_CODE,
    sendCode: async () => {},
  })
  if (!result.ok) throw new Error(`Could not issue e2e login code: ${result.error}`)
}

export async function requestCodeInUi(page: Page, email: string): Promise<void> {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send login code' }).click()
  await expect(page.getByLabel('Code')).toBeVisible()
}

export async function login({ page, email }: { page: Page; email: string }): Promise<void> {
  await requestCodeInUi(page, email)
  await issueKnownCode(email)
  await page.getByLabel('Code').fill(E2E_CODE)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/admin$/)
  await expect(page.locator('span[title="Dashboard"]').first()).toBeVisible()
}

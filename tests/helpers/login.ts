import { expect, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import { requestCode } from '../../src/features/auth/otp'
import { payloadOtpStore } from '../../src/features/auth/store'
import config from '../../src/payload.config'

export const E2E_CODE = '424242'

/** Each test gets its own client IP so per-IP rate limits and cleanup never cross workers. */
const testIp = (email: string) => `e2e:${email}`

/**
 * Rate-limit rows from earlier runs would otherwise lock the tests out. Scoped to one email/IP:
 * a global delete races with parallel workers and wipes the code another test just issued.
 */
export async function clearTestLoginCodes(email: string): Promise<void> {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'auth-codes',
    where: { or: [{ email: { equals: email } }, { requestIp: { equals: testIp(email) } }] },
  })
}

/**
 * The dev server emails (or logs) a random code we can't read, so issue a newer code
 * with a known value through the same store; verification only accepts the latest one.
 */
export async function issueKnownCode(email: string): Promise<void> {
  const payload = await getPayload({ config })
  const result = await requestCode(email, testIp(email), {
    store: payloadOtpStore(payload),
    secret: payload.secret,
    minResponseMs: 0,
    generateCode: () => E2E_CODE,
    sendCode: async () => {},
  })
  if (!result.ok) throw new Error(`Could not issue e2e login code: ${result.error}`)
}

export async function requestCodeInUi(page: Page, email: string): Promise<void> {
  await clearTestLoginCodes(email)
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': testIp(email) })
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
  // Full reload into the admin; the first dev-mode compile under parallel load can take >5s.
  await expect(page.locator('span[title="Dashboard"]').first()).toBeVisible({ timeout: 15_000 })
}

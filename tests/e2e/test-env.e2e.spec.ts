import { expect, test } from '@playwright/test'

// Wiring check for playwright.config.ts (isolateTestEnv); the helper itself is unit-tested.
test('e2e workers run without a mail provider', () => {
  expect(process.env.RESEND_API_KEY).toBeUndefined()
})

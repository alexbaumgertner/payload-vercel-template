import { expect, test } from 'vitest'

import { DEFAULT_TEST_DATABASE_URL } from '../helpers/test-env'

// Wiring check for tests/helpers/int-setup.ts; the helper itself is unit-tested.
test('int workers run without a mail provider and against the test database', () => {
  expect(process.env.RESEND_API_KEY).toBeUndefined()
  expect(process.env.DATABASE_URI).toBeUndefined()
  expect(process.env.POSTGRES_URL).toBeUndefined()
  expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL)
})

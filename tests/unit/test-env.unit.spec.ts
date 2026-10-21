import { describe, expect, test } from 'vitest'

import { DEFAULT_TEST_DATABASE_URL, isolateTestEnv, pointAtTestDatabase } from '../helpers/test-env'

describe('isolateTestEnv', () => {
  test('removes the Resend key so tests never send real mail', () => {
    const env: Record<string, string | undefined> = {
      RESEND_API_KEY: 're_live_key',
      EMAIL_FROM_ADDRESS: 'login@example.com',
    }
    isolateTestEnv(env)
    expect(env).toEqual({ EMAIL_FROM_ADDRESS: 'login@example.com' })
  })

  test('is a no-op when no key is set', () => {
    const env = { PAYLOAD_SECRET: 'x'.repeat(32) }
    isolateTestEnv(env)
    expect(env).toEqual({ PAYLOAD_SECRET: 'x'.repeat(32) })
  })
})

describe('pointAtTestDatabase', () => {
  test('points DATABASE_URL at TEST_DATABASE_URL and drops the URLs that would win over it', () => {
    const env: Record<string, string | undefined> = {
      DATABASE_URL: 'postgresql://app:app@127.0.0.1:5432/app',
      DATABASE_URI: 'postgresql://user:pw@ep-prod.neon.tech/db',
      POSTGRES_URL: 'postgresql://user:pw@ep-prod-pooler.neon.tech/db',
      TEST_DATABASE_URL: 'postgresql://app:app@127.0.0.1:5432/app_mine_test',
    }
    pointAtTestDatabase(env)
    expect(env).toEqual({
      DATABASE_URL: 'postgresql://app:app@127.0.0.1:5432/app_mine_test',
      TEST_DATABASE_URL: 'postgresql://app:app@127.0.0.1:5432/app_mine_test',
    })
  })

  test('falls back to the local app_test database', () => {
    const env: Record<string, string | undefined> = { DATABASE_URL: 'postgresql://x@y/app' }
    pointAtTestDatabase(env)
    expect(env.DATABASE_URL).toBe(DEFAULT_TEST_DATABASE_URL)
  })
})

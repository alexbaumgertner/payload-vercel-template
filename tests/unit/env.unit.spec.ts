// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { parseServerEnv as ParseServerEnv } from '@/lib/env'

const base = {
  DATABASE_URL: 'postgresql://app:app@127.0.0.1:5432/app',
  PAYLOAD_SECRET: 'a-test-secret-of-sufficient-length',
}

let parseServerEnv: typeof ParseServerEnv

beforeEach(async () => {
  // env.ts also parses process.env when imported: give it a valid one.
  for (const [key, value] of Object.entries(base)) vi.stubEnv(key, value)
  ;({ parseServerEnv } = await import('@/lib/env'))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('parseServerEnv', () => {
  it('treats `KEY=` from an env file as unset, so defaults and optionals apply', () => {
    const env = parseServerEnv({
      ...base,
      EMAIL_FROM_ADDRESS: '',
      SENTRY_DSN: '',
      PAYLOAD_DB_PUSH: '',
      ANALYTICS_PROVIDER: '',
    })
    expect(env.EMAIL_FROM_ADDRESS).toBe('onboarding@resend.dev')
    expect(env.SENTRY_DSN).toBeUndefined()
    expect(env.PAYLOAD_DB_PUSH).toBe(true)
    expect(env.ANALYTICS_PROVIDER).toBe('none')
  })

  it('resolves DATABASE_URL through the precedence and upgrades TLS', () => {
    const env = parseServerEnv({
      ...base,
      DATABASE_URI: 'postgresql://u:p@db.example.com/main?sslmode=require',
    })
    expect(env.DATABASE_URL).toBe('postgresql://u:p@db.example.com/main?sslmode=verify-full')
  })

  it('accepts POSTGRES_URL when DATABASE_URL is empty', () => {
    const env = parseServerEnv({
      PAYLOAD_SECRET: base.PAYLOAD_SECRET,
      DATABASE_URL: '',
      POSTGRES_URL: 'postgresql://u:p@db.example.com/main',
    })
    expect(env.DATABASE_URL).toBe('postgresql://u:p@db.example.com/main')
  })

  it('fails without any connection string', () => {
    expect(() => parseServerEnv({ PAYLOAD_SECRET: base.PAYLOAD_SECRET })).toThrow(/DATABASE_URL/)
  })
})

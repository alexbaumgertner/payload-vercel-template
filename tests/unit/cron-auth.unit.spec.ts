// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { cronAuthorized } from '@/lib/cron-auth'

const request = (authorization?: string) =>
  new Request('http://localhost/api/cron/backup', {
    headers: authorization ? { authorization } : {},
  })

describe('cronAuthorized with CRON_SECRET', () => {
  const env = { CRON_SECRET: 's3cret-cron-key', VERCEL_ENV: 'production' }

  it('accepts the exact bearer secret', () => {
    expect(cronAuthorized(request('Bearer s3cret-cron-key'), env)).toBe(true)
  })

  it.each([
    ['a wrong secret', 'Bearer wrong-key-of-same-size'],
    ['a prefix of the secret', 'Bearer s3cret'],
    ['a longer value', 'Bearer s3cret-cron-key-and-more'],
    ['the secret without the scheme', 's3cret-cron-key'],
    ['another scheme', 'Basic s3cret-cron-key'],
  ])('rejects %s', (_label, header) => {
    expect(cronAuthorized(request(header), env)).toBe(false)
  })

  it('rejects a request without the header', () => {
    expect(cronAuthorized(request(), env)).toBe(false)
  })

  it('trims whitespace around the configured secret', () => {
    expect(
      cronAuthorized(request('Bearer s3cret-cron-key'), { CRON_SECRET: ' s3cret-cron-key\n' }),
    ).toBe(true)
  })

  it('needs the secret locally too once it is set', () => {
    expect(cronAuthorized(request(), { CRON_SECRET: 's3cret-cron-key' })).toBe(false)
  })
})

describe('cronAuthorized without CRON_SECRET', () => {
  it.each(['production', 'preview', 'development'])(
    'fails closed on Vercel (%s): a missing secret is a misconfiguration',
    (VERCEL_ENV) => {
      expect(cronAuthorized(request(), { VERCEL_ENV })).toBe(false)
      expect(cronAuthorized(request('Bearer anything'), { VERCEL_ENV, CRON_SECRET: '  ' })).toBe(
        false,
      )
    },
  )

  it('is open locally, where VERCEL_ENV is unset', () => {
    expect(cronAuthorized(request(), {})).toBe(true)
  })
})

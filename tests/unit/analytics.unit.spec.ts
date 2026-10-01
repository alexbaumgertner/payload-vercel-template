// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { analyticsProvider, optedOut, track } from '@/lib/analytics'

const vercel = vi.hoisted(() => ({
  track: vi.fn(async (_event: string, _props?: object, _options?: object) => {}),
}))
vi.mock('@vercel/analytics/server', () => vercel)

const headersOf = (init: Record<string, string>) => vi.fn(async () => new Headers(init))

beforeEach(() => {
  vi.stubEnv('ANALYTICS_PROVIDER', 'vercel')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('analyticsProvider', () => {
  it.each([
    [undefined, 'none'],
    ['', 'none'],
    ['segment', 'none'],
    ['VERCEL', 'none'],
    ['vercel', 'vercel'],
  ])('maps ANALYTICS_PROVIDER=%j to %s', (value, expected) => {
    expect(analyticsProvider({ ANALYTICS_PROVIDER: value })).toBe(expected)
  })
})

describe('optedOut', () => {
  it.each([
    [{ dnt: '1' }, true],
    [{ 'sec-gpc': '1' }, true],
    [{ dnt: '0' }, false],
    [{}, false],
  ])('treats %j as opted out: %s', (init, expected) => {
    expect(optedOut(new Headers(init))).toBe(expected)
  })
})

describe('track', () => {
  it('sends nothing and never reads the request without a provider', async () => {
    vi.stubEnv('ANALYTICS_PROVIDER', '')
    const headers = headersOf({})

    await track('login_succeeded', {}, headers)

    expect(headers).not.toHaveBeenCalled()
    expect(vercel.track).not.toHaveBeenCalled()
  })

  it('sends catalog events to Vercel with only the headers it needs', async () => {
    await track(
      'waitlist_joined',
      { source: 'landing-hero' },
      headersOf({
        'user-agent': 'UA',
        'x-forwarded-for': '203.0.113.7',
        cookie: 'indie_session=secret',
        referer: 'https://app.example/?email=jane@example.com#top',
      }),
    )

    expect(vercel.track).toHaveBeenCalledWith(
      'waitlist_joined',
      { source: 'landing-hero' },
      {
        headers: {
          'user-agent': 'UA',
          'x-forwarded-for': '203.0.113.7',
          referer: 'https://app.example/',
        },
      },
    )
  })

  it.each([
    ['Do Not Track', { dnt: '1' }],
    ['Global Privacy Control', { 'sec-gpc': '1' }],
  ])('respects %s', async (_label, init) => {
    await track('login_succeeded', {}, headersOf(init))
    expect(vercel.track).not.toHaveBeenCalled()
  })

  it.each([
    ['an email as a prop value', { source: 'jane@example.com' }],
    ['a prop that is not in the catalog', { source: 'landing-hero', email: 'jane@example.com' }],
    ['a value longer than 64 characters', { source: 'a'.repeat(65) }],
    ['an empty object', {}],
  ])('drops events with %s', async (_label, props) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await track('waitlist_joined', props as never, headersOf({}))

    expect(vercel.track).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dropped "waitlist_joined"'))
  })

  it('swallows provider failures so the feature keeps working', async () => {
    vercel.track.mockRejectedValueOnce(new Error('503'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(track('login_succeeded', {}, headersOf({}))).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith(
      '[analytics] "login_succeeded" was not sent',
      expect.any(Error),
    )
  })

  it('swallows a missing request context', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const outsideRequest = async (): Promise<Headers> => {
      throw new Error('headers() was called outside a request scope')
    }

    await expect(track('login_succeeded', {}, outsideRequest)).resolves.toBeUndefined()
    expect(vercel.track).not.toHaveBeenCalled()
  })
})

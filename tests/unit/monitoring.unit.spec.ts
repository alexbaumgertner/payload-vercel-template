// @vitest-environment node
import type { ErrorEvent } from '@sentry/nextjs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  monitoringConfig,
  scrubBreadcrumb,
  scrubEvent,
  sentryOptions,
} from '@/lib/monitoring/options'

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  withServerActionInstrumentation: vi.fn(
    (_name: string, _options: object, callback: () => unknown) => callback(),
  ),
}))
vi.mock('@sentry/nextjs', () => sentry)

const DSN = 'https://public@o1.ingest.sentry.io/1'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  vi.resetModules()
})

describe('monitoringConfig', () => {
  it.each([
    ['unset', {}],
    ['empty', { SENTRY_DSN: '' }],
    ['blank', { SENTRY_DSN: '   ' }],
  ])('is off when SENTRY_DSN is %s', (_label, source) => {
    expect(monitoringConfig(source)).toBeNull()
  })

  it('takes environment and release from Vercel when not set explicitly', () => {
    expect(
      monitoringConfig({ SENTRY_DSN: DSN, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_SHA: 'abc123' }),
    ).toEqual({ dsn: DSN, environment: 'preview', release: 'abc123' })
  })

  it('prefers explicit SENTRY_ENVIRONMENT and SENTRY_RELEASE', () => {
    expect(
      monitoringConfig({
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: 'staging',
        SENTRY_RELEASE: 'v1',
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_SHA: 'abc123',
      }),
    ).toMatchObject({ environment: 'staging', release: 'v1' })
  })
})

describe('sentryOptions', () => {
  it('turns off collection of user data, bodies, cookies, query strings and locals', () => {
    const { dataCollection } = sentryOptions({ dsn: DSN })
    expect(dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      graphQL: { variables: false },
    })
  })

  it('never ships structured logs', () => {
    expect(sentryOptions({ dsn: DSN }).beforeSendLog()).toBeNull()
  })
})

describe('scrubEvent', () => {
  const event = (): ErrorEvent => ({
    type: undefined,
    message: 'Failed to email jane.doe@example.com',
    exception: { values: [{ type: 'Error', value: 'Resend rejected bob@corp.io' }] },
    user: { id: '42', email: 'jane.doe@example.com', ip_address: '1.2.3.4', username: 'jane' },
    request: {
      method: 'POST',
      url: 'https://app.example/admin/login?redirect=/admin&email=jane.doe@example.com',
      data: 'email=jane.doe%40example.com&code=123456',
      cookies: { indie_session: 'secret' },
      query_string: 'email=jane.doe@example.com',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        cookie: 'indie_session=secret',
        authorization: 'Bearer token',
        'x-forwarded-for': '1.2.3.4',
      },
    },
    breadcrumbs: [
      { category: 'console', message: 'login code for jane.doe@example.com: 123456' },
      { category: 'fetch', data: { url: 'https://api.resend.com/emails?to=jane.doe@example.com' } },
    ],
  })

  it('drops request bodies, cookies and query strings', () => {
    const { request } = scrubEvent(event())
    expect(request).toEqual({
      method: 'POST',
      url: 'https://app.example/admin/login',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
  })

  it('keeps only the user id', () => {
    expect(scrubEvent(event()).user).toEqual({ id: '42' })
    expect(scrubEvent({ ...event(), user: { email: 'a@b.co' } }).user).toBeUndefined()
  })

  it('redacts email addresses anywhere in the event', () => {
    const scrubbed = scrubEvent(event())
    expect(scrubbed.message).toBe('Failed to email [email]')
    expect(scrubbed.exception?.values?.[0]?.value).toBe('Resend rejected [email]')
    expect(JSON.stringify(scrubbed)).not.toMatch(/@example\.com|@corp\.io/)
  })

  it('drops console breadcrumbs, which can contain login codes', () => {
    const crumbs = scrubEvent(event()).breadcrumbs ?? []
    expect(crumbs.map((crumb) => crumb.category)).toEqual(['fetch'])
    expect(crumbs[0]?.data?.url).toBe('https://api.resend.com/emails')
  })

  it('handles events without request, user or breadcrumbs', () => {
    expect(scrubEvent({ type: undefined, message: 'plain' })).toEqual({
      type: undefined,
      message: 'plain',
    })
  })
})

describe('scrubBreadcrumb', () => {
  it('drops console output and keeps navigation without query strings', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'x' })).toBeNull()
    expect(
      scrubBreadcrumb({ category: 'navigation', data: { url: '/changelog?ref=mail' } }),
    ).toEqual({ category: 'navigation', data: { url: '/changelog' } })
  })
})

describe('server helpers', () => {
  const load = () => import('@/lib/monitoring/server')

  it('runs the action directly and never loads Sentry without a DSN', async () => {
    vi.stubEnv('SENTRY_DSN', '')
    const { monitorAction, captureServerError } = await load()

    await expect(monitorAction('test', async () => 'ok')).resolves.toBe('ok')
    await captureServerError(new Error('boom'), 'test')

    expect(sentry.withServerActionInstrumentation).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it('wraps actions without recording the response when a DSN is set', async () => {
    vi.stubEnv('SENTRY_DSN', DSN)
    const { monitorAction } = await load()

    await expect(monitorAction('loginAction', async () => 'ok')).resolves.toBe('ok')
    expect(sentry.withServerActionInstrumentation).toHaveBeenCalledWith(
      'loginAction',
      { recordResponse: false },
      expect.any(Function),
    )
  })

  it('still throws the original error from a monitored action', async () => {
    vi.stubEnv('SENTRY_DSN', DSN)
    const { monitorAction } = await load()

    await expect(
      monitorAction('loginAction', async () => {
        throw new Error('db down')
      }),
    ).rejects.toThrow('db down')
  })

  it('tags caught errors with their area when a DSN is set', async () => {
    vi.stubEnv('SENTRY_DSN', DSN)
    const { captureServerError } = await load()
    const error = new Error('mail down')

    await captureServerError(error, 'auth-email')

    expect(sentry.captureException).toHaveBeenCalledWith(error, { tags: { area: 'auth-email' } })
  })
})

describe('client helper', () => {
  it('ignores errors when the build has no DSN', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '')
    const { reportClientError } = await import('@/lib/monitoring/client')

    reportClientError(new Error('render failed'))
    await vi.dynamicImportSettled()

    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it('reports render errors when the build has a DSN', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN)
    const { reportClientError } = await import('@/lib/monitoring/client')
    const error = new Error('render failed')

    reportClientError(error)
    await vi.dynamicImportSettled()

    expect(sentry.captureException).toHaveBeenCalledWith(error)
  })
})

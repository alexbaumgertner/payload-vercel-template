import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loginAction } from '@/features/auth/actions'
import type { LoginState } from '@/features/auth/schema'

const request = vi.hoisted(() => ({
  headers: new Headers(),
  cookies: { set: vi.fn() },
}))
vi.mock('next/headers', () => ({
  headers: async () => request.headers,
  cookies: async () => request.cookies,
}))

const vercel = vi.hoisted(() => ({
  track: vi.fn(async (_event: string, _props?: object, _options?: object) => {}),
}))
vi.mock('@vercel/analytics/server', () => vercel)

const USER_EMAIL = 'int-login-action@example.com'
let payload: Payload

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

/** Without RESEND_API_KEY the dev sender prints the code; read it from there. */
async function requestCodeFor(email: string, prev: LoginState = { step: 'email', email: '' }) {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const state = await loginAction(prev, form({ intent: 'request', email }))
  const code = info.mock.calls
    .flat()
    .join(' ')
    .match(/: (\d{6})/)?.[1]
  info.mockRestore()
  return { state, code }
}

const sentEvents = () => vercel.track.mock.calls.map(([event, props]) => ({ event, props }))

describe('loginAction analytics', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await payload.delete({ collection: 'users', where: { email: { equals: USER_EMAIL } } })
    await payload.create({ collection: 'users', data: { email: USER_EMAIL } })
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubEnv('SENTRY_DSN', '')
    vi.stubEnv('ANALYTICS_PROVIDER', 'vercel')
    request.headers = new Headers({ 'x-forwarded-for': '203.0.113.7', 'user-agent': 'int-test' })
    await payload.delete({ collection: 'auth-codes', where: { id: { exists: true } } })
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await payload.delete({ collection: 'auth-codes', where: { id: { exists: true } } })
    await payload.delete({ collection: 'users', where: { email: { equals: USER_EMAIL } } })
    await payload.destroy()
  })

  it('tracks a code request and a successful login without the email', async () => {
    const { state, code } = await requestCodeFor(USER_EMAIL)
    expect(state.step).toBe('code')
    expect(code).toMatch(/^\d{6}$/)

    const done = await loginAction(state, form({ intent: 'verify', code: code ?? '' }))

    expect(done).toEqual({ step: 'done', redirectTo: '/admin' })
    expect(sentEvents()).toEqual([
      { event: 'login_code_requested', props: { resend: false } },
      { event: 'login_succeeded', props: {} },
    ])
    expect(JSON.stringify(vercel.track.mock.calls)).not.toContain(USER_EMAIL)
  })

  it('marks a resend from the code step', async () => {
    const { state } = await requestCodeFor(USER_EMAIL)
    vi.clearAllMocks()

    await requestCodeFor(USER_EMAIL, state)

    expect(sentEvents()).toEqual([{ event: 'login_code_requested', props: { resend: true } }])
  })

  it('tracks nothing for a malformed email or a wrong code', async () => {
    await requestCodeFor('not-an-email')
    const { state } = await requestCodeFor(USER_EMAIL)
    vi.clearAllMocks()

    const wrong = await loginAction(state, form({ intent: 'verify', code: '000000' }))

    expect(wrong).toMatchObject({ step: 'code', error: expect.any(String) })
    expect(vercel.track).not.toHaveBeenCalled()
  })

  it('tracks nothing when the visitor sends Do Not Track', async () => {
    request.headers = new Headers({ 'x-forwarded-for': '203.0.113.8', dnt: '1' })

    const { state, code } = await requestCodeFor(USER_EMAIL)
    await loginAction(state, form({ intent: 'verify', code: code ?? '' }))

    expect(vercel.track).not.toHaveBeenCalled()
  })

  it('still signs in when the analytics provider is down', async () => {
    vercel.track.mockRejectedValue(new Error('analytics outage'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { state, code } = await requestCodeFor(USER_EMAIL)
    const done = await loginAction(state, form({ intent: 'verify', code: code ?? '' }))

    expect(done).toEqual({ step: 'done', redirectTo: '/admin' })
    expect(request.cookies.set).toHaveBeenCalled()
    warn.mockRestore()
    vercel.track.mockReset()
  })
})

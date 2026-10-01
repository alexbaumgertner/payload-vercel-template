import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { joinWaitlistAction } from '@/features/waitlist/actions'
import { initialWaitlistState } from '@/features/waitlist/schema'
import { joinWaitlist } from '@/features/waitlist/service'

vi.mock('@/features/waitlist/service', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/waitlist/service')>()
  return { ...original, joinWaitlist: vi.fn(original.joinWaitlist) }
})

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  withServerActionInstrumentation: vi.fn(
    (_name: string, _options: object, callback: () => unknown) => callback(),
  ),
}))
vi.mock('@sentry/nextjs', () => sentry)

const request = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock('next/headers', () => ({ headers: async () => request.headers }))

const vercel = vi.hoisted(() => ({
  track: vi.fn(async (_event: string, _props?: object, _options?: object) => {}),
}))
vi.mock('@vercel/analytics/server', () => vercel)

let payload: Payload

const submit = (fields: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) formData.set(key, value)
  return joinWaitlistAction(initialWaitlistState, formData)
}
const signups = async () => (await payload.count({ collection: 'waitlist-signups' })).totalDocs

describe('joinWaitlistAction', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  beforeEach(async () => {
    vi.stubEnv('SENTRY_DSN', '')
    vi.stubEnv('ANALYTICS_PROVIDER', '')
    request.headers = new Headers({ 'user-agent': 'int-test' })
    vi.clearAllMocks()
    await payload.delete({ collection: 'waitlist-signups', where: { id: { exists: true } } })
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await payload.destroy()
  })

  it('stores a valid signup with its source and reports success', async () => {
    const state = await submit({ email: ' New@Example.com ', source: 'landing-hero', company: '' })

    expect(state.status).toBe('success')
    const { docs } = await payload.find({ collection: 'waitlist-signups' })
    expect(docs[0]).toMatchObject({ email: 'new@example.com', source: 'landing-hero' })
  })

  it('pretends success for bots that fill the honeypot, but stores nothing', async () => {
    const state = await submit({ email: 'bot@example.com', company: 'Spam Inc' })

    expect(state.status).toBe('success')
    expect(await signups()).toBe(0)
  })

  it.each([
    ['empty', ''],
    ['missing @', 'not-an-email'],
    ['too long', `${'a'.repeat(250)}@example.com`],
  ])('rejects an %s email with a field error and stores nothing', async (_label, email) => {
    const state = await submit({ email })

    expect(state).toMatchObject({
      status: 'error',
      fieldErrors: { email: ['Enter a valid email address.'] },
    })
    expect(await signups()).toBe(0)
  })

  it('answers an existing email exactly like a new one', async () => {
    const first = await submit({ email: 'dup@example.com' })
    const second = await submit({ email: 'dup@example.com' })

    expect(second).toEqual(first)
    expect(await signups()).toBe(1)
  })

  it('shows a retry message and logs when the database fails', async () => {
    vi.mocked(joinWaitlist).mockRejectedValueOnce(new Error('connection refused'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    const state = await submit({ email: 'down@example.com' })

    expect(state).toEqual({
      status: 'error',
      message: 'Something went wrong on our side. Please try again.',
    })
    expect(log).toHaveBeenCalledWith('[waitlist] failed to save signup', expect.any(Error))
    log.mockRestore()
  })

  it('sends no analytics without ANALYTICS_PROVIDER', async () => {
    await submit({ email: 'quiet@example.com', source: 'landing-hero' })

    expect(vercel.track).not.toHaveBeenCalled()
  })

  it('tracks a new signup once, with the source only', async () => {
    vi.stubEnv('ANALYTICS_PROVIDER', 'vercel')

    await submit({ email: 'counted@example.com', source: 'landing-hero' })
    await submit({ email: 'counted@example.com', source: 'landing-hero' })

    expect(vercel.track).toHaveBeenCalledTimes(1)
    expect(vercel.track).toHaveBeenCalledWith(
      'waitlist_joined',
      { source: 'landing-hero' },
      { headers: { 'user-agent': 'int-test' } },
    )
  })

  it('tracks nothing for bots, invalid emails or failed saves', async () => {
    vi.stubEnv('ANALYTICS_PROVIDER', 'vercel')
    vi.mocked(joinWaitlist).mockRejectedValueOnce(new Error('connection refused'))
    vi.spyOn(console, 'error').mockImplementationOnce(() => {})

    await submit({ email: 'down@example.com' })
    await submit({ email: 'bot@example.com', company: 'Spam Inc' })
    await submit({ email: 'not-an-email' })

    expect(vercel.track).not.toHaveBeenCalled()
  })

  it('tracks nothing when the visitor sends Global Privacy Control', async () => {
    vi.stubEnv('ANALYTICS_PROVIDER', 'vercel')
    request.headers = new Headers({ 'sec-gpc': '1' })

    const state = await submit({ email: 'private@example.com', source: 'landing-hero' })

    expect(state.status).toBe('success')
    expect(vercel.track).not.toHaveBeenCalled()
  })

  it('never touches Sentry when SENTRY_DSN is unset, even on failure', async () => {
    vi.mocked(joinWaitlist).mockRejectedValueOnce(new Error('connection refused'))
    vi.spyOn(console, 'error').mockImplementationOnce(() => {})

    await submit({ email: 'down@example.com' })

    expect(sentry.withServerActionInstrumentation).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it('reports a database failure to Sentry without the form data when a DSN is set', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://public@o1.ingest.sentry.io/1')
    const failure = new Error('connection refused')
    vi.mocked(joinWaitlist).mockRejectedValueOnce(failure)
    vi.spyOn(console, 'error').mockImplementationOnce(() => {})

    const state = await submit({ email: 'down@example.com' })

    expect(state.status).toBe('error')
    expect(sentry.withServerActionInstrumentation).toHaveBeenCalledWith(
      'joinWaitlistAction',
      { recordResponse: false },
      expect.any(Function),
    )
    expect(sentry.captureException).toHaveBeenCalledWith(failure, { tags: { area: 'waitlist' } })
  })
})

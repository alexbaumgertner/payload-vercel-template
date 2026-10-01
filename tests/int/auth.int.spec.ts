import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { requestCode, verifyCode, type OtpDeps } from '@/features/auth/otp'
import { issueToken, SESSION_COOKIE } from '@/features/auth/session'
import { payloadOtpStore } from '@/features/auth/store'

let payload: Payload
let deps: OtpDeps
const sent: Array<{ to: string; code: string }> = []
const USER_EMAIL = 'int-admin@example.com'

describe('email-code auth against Postgres', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await payload.delete({ collection: 'users', where: { email: { equals: USER_EMAIL } } })
    await payload.create({ collection: 'users', data: { email: USER_EMAIL } })
  })

  beforeEach(async () => {
    sent.length = 0
    await payload.delete({ collection: 'auth-codes', where: { id: { exists: true } } })
    deps = {
      store: payloadOtpStore(payload),
      secret: payload.secret,
      minResponseMs: 0,
      sendCode: async (to, code) => {
        sent.push({ to, code })
      },
    }
  })

  afterAll(async () => {
    await payload.delete({ collection: 'auth-codes', where: { id: { exists: true } } })
    await payload.delete({ collection: 'users', where: { email: { equals: USER_EMAIL } } })
    await payload.destroy()
  })

  it('issues a code for a real user and verifies it exactly once', async () => {
    expect((await requestCode(USER_EMAIL, '198.51.100.1', deps)).ok).toBe(true)
    const code = sent[0]?.code
    expect(code).toMatch(/^\d{6}$/)

    const first = await verifyCode(USER_EMAIL, code!, deps)
    expect(first.ok).toBe(true)
    expect((await verifyCode(USER_EMAIL, code!, deps)).ok).toBe(false)
  })

  it('stores a row but sends nothing for unknown addresses', async () => {
    expect((await requestCode('nobody@example.com', '198.51.100.2', deps)).ok).toBe(true)
    expect(sent).toHaveLength(0)
    expect((await payload.count({ collection: 'auth-codes' })).totalDocs).toBe(1)
  })

  it('keeps login codes closed to the public API', async () => {
    await requestCode(USER_EMAIL, '198.51.100.3', deps)
    await expect(
      payload.find({ collection: 'auth-codes', overrideAccess: false }),
    ).rejects.toThrow()
  })

  it('hides the user list from anonymous API clients', async () => {
    await expect(payload.find({ collection: 'users', overrideAccess: false })).rejects.toThrow()
  })

  it('has no self sign-up: anonymous clients cannot create users', async () => {
    await expect(
      payload.create({
        collection: 'users',
        data: { email: 'intruder@example.com' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    const where = { email: { equals: 'intruder@example.com' } }
    expect((await payload.count({ collection: 'users', where })).totalDocs).toBe(0)
  })

  it('lets a signed-in user read users with access control on', async () => {
    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: USER_EMAIL } },
    })
    const user = { ...docs[0]!, collection: 'users' as const }
    const result = await payload.find({ collection: 'users', overrideAccess: false, user })
    expect(result.docs.map((d) => d.email)).toContain(USER_EMAIL)
  })

  it('authenticates requests carrying a valid session cookie', async () => {
    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: USER_EMAIL } },
    })
    const { token } = issueToken(docs[0]!.id, payload.secret)

    const signedIn = await payload.auth({
      headers: new Headers({ cookie: `${SESSION_COOKIE}=${token}` }),
    })
    expect(signedIn.user?.email).toBe(USER_EMAIL)

    const forged = await payload.auth({
      headers: new Headers({ cookie: `${SESSION_COOKIE}=${docs[0]!.id}.9999999999.forged` }),
    })
    expect(forged.user).toBeNull()
  })
})

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { joinWaitlist } from '@/features/waitlist/service'

let payload: Payload

describe('joinWaitlist', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  beforeEach(async () => {
    await payload.delete({ collection: 'waitlist-signups', where: { id: { exists: true } } })
  })

  afterAll(async () => {
    await payload.destroy()
  })

  it('creates a signup for a new email', async () => {
    const result = await joinWaitlist(payload, { email: 'new@example.com', source: 'test' })

    expect(result).toEqual({ created: true })
    const { docs } = await payload.find({ collection: 'waitlist-signups' })
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ email: 'new@example.com', source: 'test' })
  })

  it('is idempotent for an existing email', async () => {
    await joinWaitlist(payload, { email: 'dup@example.com' })
    const second = await joinWaitlist(payload, { email: 'dup@example.com' })

    expect(second).toEqual({ created: false })
    const { totalDocs } = await payload.count({ collection: 'waitlist-signups' })
    expect(totalDocs).toBe(1)
  })

  it('keeps signups private from anonymous API access', async () => {
    await joinWaitlist(payload, { email: 'private@example.com' })

    await expect(
      payload.find({ collection: 'waitlist-signups', overrideAccess: false }),
    ).rejects.toThrow()
  })

  it('refuses anonymous creates, updates and deletes through the API', async () => {
    await expect(
      payload.create({
        collection: 'waitlist-signups',
        data: { email: 'anon@example.com' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await joinWaitlist(payload, { email: 'target@example.com' })
    const where = { email: { equals: 'target@example.com' } }
    await expect(
      payload.update({
        collection: 'waitlist-signups',
        where,
        data: { source: 'x' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.delete({ collection: 'waitlist-signups', where, overrideAccess: false }),
    ).rejects.toThrow()
    expect((await payload.count({ collection: 'waitlist-signups', where })).totalDocs).toBe(1)
  })

  it('lets a signed-in admin read signups with access control on', async () => {
    await joinWaitlist(payload, { email: 'visible@example.com' })
    const user = await payload.create({
      collection: 'users',
      data: { email: 'waitlist-reader@example.com' },
    })
    try {
      const { docs } = await payload.find({
        collection: 'waitlist-signups',
        overrideAccess: false,
        user: { ...user, collection: 'users' },
      })
      expect(docs.map((d) => d.email)).toEqual(['visible@example.com'])
    } finally {
      await payload.delete({ collection: 'users', id: user.id })
    }
  })

  it('treats two simultaneous submits of the same email as one signup', async () => {
    const results = await Promise.all([
      joinWaitlist(payload, { email: 'double@example.com' }),
      joinWaitlist(payload, { email: 'double@example.com' }),
    ])

    expect(results.map((r) => r.created).sort()).toEqual([false, true])
    const { totalDocs } = await payload.count({ collection: 'waitlist-signups' })
    expect(totalDocs).toBe(1)
  })
})

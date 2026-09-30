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
})

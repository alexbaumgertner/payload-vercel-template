import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getChangelogEntries } from '@/features/changelog/queries'

let payload: Payload

const context = { disableRevalidate: true }

describe('changelog access', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await payload.delete({ collection: 'changelog', where: { id: { exists: true } }, context })

    const dayMs = 24 * 60 * 60 * 1000
    await payload.create({
      collection: 'changelog',
      context,
      data: {
        title: 'Shipped',
        tag: 'feature',
        summary: 'Already live',
        publishedAt: new Date(Date.now() - dayMs).toISOString(),
      },
    })
    await payload.create({
      collection: 'changelog',
      context,
      data: {
        title: 'Older',
        tag: 'improvement',
        summary: 'Shipped last week',
        publishedAt: new Date(Date.now() - 7 * dayMs).toISOString(),
      },
    })
    await payload.create({
      collection: 'changelog',
      context,
      data: {
        title: 'Scheduled',
        tag: 'fix',
        summary: 'Goes live tomorrow',
        publishedAt: new Date(Date.now() + dayMs).toISOString(),
      },
    })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'changelog', where: { id: { exists: true } }, context })
    await payload.destroy()
  })

  it('hides entries scheduled in the future from anonymous readers', async () => {
    const { docs } = await payload.find({ collection: 'changelog', overrideAccess: false })
    expect(docs.map((d) => d.title).sort()).toEqual(['Older', 'Shipped'])
  })

  it('shows every entry to the Local API with access override', async () => {
    const { totalDocs } = await payload.count({ collection: 'changelog' })
    expect(totalDocs).toBe(3)
  })

  it('shows scheduled entries to a signed-in user with access control on', async () => {
    const user = await payload.create({
      collection: 'users',
      data: { email: 'editor@example.com' },
    })
    try {
      const { docs } = await payload.find({
        collection: 'changelog',
        overrideAccess: false,
        user: { ...user, collection: 'users' },
      })
      expect(docs.map((d) => d.title)).toContain('Scheduled')
    } finally {
      await payload.delete({ collection: 'users', id: user.id })
    }
  })

  it('lists published entries newest first on the public page', async () => {
    const entries = await getChangelogEntries()
    expect(entries.map((d) => d.title)).toEqual(['Shipped', 'Older'])
  })

  it('refuses anonymous creates, updates and deletes through the API', async () => {
    const where = { title: { equals: 'Shipped' } }
    await expect(
      payload.create({
        collection: 'changelog',
        context,
        overrideAccess: false,
        data: { title: 'Hijack', tag: 'fix', summary: 'x', publishedAt: new Date().toISOString() },
      }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'changelog',
        context,
        where,
        data: { title: 'Defaced' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.delete({ collection: 'changelog', context, where, overrideAccess: false }),
    ).rejects.toThrow()
    expect((await payload.count({ collection: 'changelog', where })).totalDocs).toBe(1)
  })

  it('rejects a summary longer than 280 characters', async () => {
    await expect(
      payload.create({
        collection: 'changelog',
        context,
        data: {
          title: 'Too long',
          tag: 'feature',
          summary: 'x'.repeat(281),
          publishedAt: new Date().toISOString(),
        },
      }),
    ).rejects.toThrow(/summary/i)
  })
})

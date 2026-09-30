import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

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
    expect(docs.map((d) => d.title)).toEqual(['Shipped'])
  })

  it('shows every entry to the Local API with access override', async () => {
    const { totalDocs } = await payload.count({ collection: 'changelog' })
    expect(totalDocs).toBe(2)
  })
})

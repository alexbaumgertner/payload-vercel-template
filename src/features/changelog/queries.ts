import 'server-only'

import { getPayloadClient } from '@/lib/payload'

export async function getChangelogEntries({ limit = 20 }: { limit?: number } = {}) {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'changelog',
    limit,
    sort: '-publishedAt',
    depth: 0,
    overrideAccess: false,
  })
  return docs
}

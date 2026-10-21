import 'server-only'

import { defaultLocale, type locales } from '@/i18n/locales'
import { getPayloadClient } from '@/lib/payload'
import { latest } from '@/lib/seo'

type Options = { limit?: number; locale?: (typeof locales)[number] }

/** Published entries in `locale`; fields without a translation fall back to English. */
export async function getChangelogEntries({ limit = 20, locale = defaultLocale }: Options = {}) {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'changelog',
    limit,
    locale,
    fallbackLocale: defaultLocale,
    sort: '-publishedAt',
    depth: 0,
    overrideAccess: false,
  })
  return docs
}

/**
 * When the public changelog last changed: the newest `updatedAt` or `publishedAt` among published
 * entries (an entry scheduled for later changes the page when it goes live, not when it was saved).
 */
export async function getChangelogLastModified(): Promise<string | null> {
  const payload = await getPayloadClient()
  const newest = (sort: string) =>
    payload.find({
      collection: 'changelog',
      limit: 1,
      sort,
      depth: 0,
      select: { publishedAt: true, updatedAt: true },
      overrideAccess: false,
    })
  const [byUpdate, byPublish] = await Promise.all([newest('-updatedAt'), newest('-publishedAt')])
  return latest(
    [...byUpdate.docs, ...byPublish.docs].flatMap((doc) => [doc.updatedAt, doc.publishedAt]),
  )
}

import type { MetadataRoute } from 'next'

import { getChangelogLastModified } from '@/features/changelog/queries'
import { buildSitemap } from '@/lib/seo'
import { siteUrl } from '@/lib/site-url'

// Reads published content on every request (crawlers fetch it rarely; nothing to revalidate).
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const changelogUpdated = await getChangelogLastModified()
  // Every public page (also listed in tests/helpers/public-pages.ts). Both show changelog entries.
  return buildSitemap(siteUrl(), [
    { path: '/', lastModified: changelogUpdated },
    { path: '/changelog', lastModified: changelogUpdated },
  ])
}

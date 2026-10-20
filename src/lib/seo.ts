import type { MetadataRoute } from 'next'

import { languageAlternates, localizedPath } from '@/i18n/alternates'
import { routing } from '@/i18n/routing'

type Env = Record<string, string | undefined>

/** A public page by its unprefixed path, dated by the content it shows. */
export type SitemapPage = { path: string; lastModified?: string | Date | null }

function toDate(value: SitemapPage['lastModified']): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * One entry per page and locale (`/`, `/ru`, `/changelog`, `/ru/changelog` …), each listing every
 * locale and `x-default` as hreflang alternates — the same map `alternatesFor` puts in the page head.
 */
export function buildSitemap(site: string, pages: SitemapPage[]): MetadataRoute.Sitemap {
  const origin = site.replace(/\/+$/, '')
  return pages.flatMap((page) => {
    const languages = Object.fromEntries(
      Object.entries(languageAlternates(page.path)).map(([lang, path]) => [lang, origin + path]),
    )
    const lastModified = toDate(page.lastModified)
    return routing.locales.map((locale) => ({
      url: origin + localizedPath(page.path, locale),
      ...(lastModified && { lastModified }),
      alternates: { languages },
    }))
  })
}

/**
 * Only the production deployment may be indexed. Previews, `vercel dev` and local runs disallow
 * everything (Vercel also sends `X-Robots-Tag: noindex` on previews; this covers custom domains).
 */
export function buildRobots(site: string, env: Env): MetadataRoute.Robots {
  if (env.VERCEL_ENV !== 'production') {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  const origin = site.replace(/\/+$/, '')
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: `${origin}/sitemap.xml`,
  }
}

/** Newest of the given timestamps (ISO strings), or null. */
export function latest(values: Array<string | null | undefined>): string | null {
  let best: string | null = null
  for (const value of values) {
    if (
      value &&
      !Number.isNaN(Date.parse(value)) &&
      (!best || Date.parse(value) > Date.parse(best))
    )
      best = value
  }
  return best
}

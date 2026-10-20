import { describe, expect, it } from 'vitest'

import { alternatesFor } from '@/i18n/alternates'
import { routing } from '@/i18n/routing'
import { buildRobots, buildSitemap, latest } from '@/lib/seo'
import { siteUrl } from '@/lib/site-url'

const SITE = 'https://example.com'

describe('siteUrl', () => {
  it('prefers NEXT_PUBLIC_SITE_URL and drops a trailing slash', () => {
    expect(
      siteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://example.com/',
        VERCEL_PROJECT_PRODUCTION_URL: 'app.vercel.app',
        VERCEL_URL: 'app-git-x.vercel.app',
      }),
    ).toBe('https://example.com')
  })

  it('then the production domain, then the deployment URL, as https', () => {
    expect(
      siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'app.vercel.app', VERCEL_URL: 'app-x.vercel.app' }),
    ).toBe('https://app.vercel.app')
    expect(siteUrl({ VERCEL_URL: 'app-x.vercel.app' })).toBe('https://app-x.vercel.app')
  })

  it('falls back to localhost; blank values count as unset', () => {
    expect(siteUrl({})).toBe('http://localhost:3000')
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: ' ', VERCEL_URL: '' })).toBe('http://localhost:3000')
  })
})

describe('buildRobots', () => {
  it('allows indexing only on the production deployment', () => {
    expect(buildRobots(SITE, { VERCEL_ENV: 'production' })).toEqual({
      rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
      sitemap: `${SITE}/sitemap.xml`,
    })
  })

  it.each([undefined, 'preview', 'development', ''])(
    'disallows everything when VERCEL_ENV is %j',
    (VERCEL_ENV) => {
      const robots = buildRobots(SITE, { VERCEL_ENV })
      expect(robots.rules).toEqual({ userAgent: '*', disallow: '/' })
      expect(robots.sitemap).toBeUndefined()
    },
  )
})

describe('buildSitemap', () => {
  const sitemap = buildSitemap(`${SITE}/`, [
    { path: '/', lastModified: '2026-10-01T10:00:00.000Z' },
    { path: '/changelog', lastModified: null },
  ])

  it('lists every page once per locale, with locale prefixes only outside the default', () => {
    expect(sitemap.map((entry) => entry.url)).toEqual([
      `${SITE}/`,
      `${SITE}/ru`,
      `${SITE}/changelog`,
      `${SITE}/ru/changelog`,
    ])
    expect(sitemap).toHaveLength(2 * routing.locales.length)
  })

  it('gives each entry the same hreflang map as the page head, made absolute', () => {
    const pages = ['/', '/changelog']
    pages.forEach((path, index) => {
      const head = alternatesFor(path, routing.defaultLocale)?.languages ?? {}
      const absolute = Object.fromEntries(
        Object.entries(head).map(([lang, url]) => [lang, `${SITE}${String(url)}`]),
      )
      const entries = sitemap.slice(
        index * routing.locales.length,
        (index + 1) * routing.locales.length,
      )
      for (const entry of entries) expect(entry.alternates?.languages, entry.url).toEqual(absolute)
    })
    expect(sitemap[1]?.alternates?.languages).toEqual({
      en: `${SITE}/`,
      ru: `${SITE}/ru`,
      'x-default': `${SITE}/`,
    })
  })

  it('uses only the given origin', () => {
    const hosts = new Set(
      [...JSON.stringify(sitemap).matchAll(/https?:\/\/[^/"]+/g)].map((m) => m[0]),
    )
    expect([...hosts]).toEqual([SITE])
  })

  it('dates pages from their content and leaves unknown dates out', () => {
    expect(sitemap[0]?.lastModified).toEqual(new Date('2026-10-01T10:00:00.000Z'))
    expect(sitemap[2]).not.toHaveProperty('lastModified')
    expect(buildSitemap(SITE, [{ path: '/', lastModified: 'not a date' }])[0]).not.toHaveProperty(
      'lastModified',
    )
  })
})

describe('latest', () => {
  it('returns the newest valid timestamp or null', () => {
    expect(latest(['2026-01-02T00:00:00Z', null, '2026-03-01T00:00:00Z', 'nope'])).toBe(
      '2026-03-01T00:00:00Z',
    )
    expect(latest([null, undefined])).toBeNull()
  })
})

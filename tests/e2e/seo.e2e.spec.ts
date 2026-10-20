import { expect, test } from '@playwright/test'

import { localizedPath } from '../../src/i18n/alternates'
import { routing } from '../../src/i18n/routing'
import { publicPages } from '../helpers/public-pages'

test.describe('robots.txt', () => {
  test('outside production, nothing may be indexed and no sitemap is advertised', async ({
    request,
  }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/plain')
    const body = await response.text()
    expect(body).toMatch(/^Disallow: \/$/m)
    expect(body).not.toMatch(/^Allow:/m)
    expect(body).not.toContain('Sitemap:')
  })
})

test.describe('sitemap.xml', () => {
  test('lists every public page in every locale with hreflang alternates', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('xml')
    const xml = await response.text()

    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1] ?? ''))
    expect(new Set(locs.map((url) => url.origin)).size).toBe(1)
    const paths = locs.map((url) => url.pathname)
    for (const page of publicPages) {
      for (const locale of routing.locales) {
        expect(paths, `${locale} ${page}`).toContain(localizedPath(page, locale))
      }
    }
    expect(paths).toHaveLength(publicPages.length * routing.locales.length)

    const entries = xml.split('<url>').slice(1)
    for (const entry of entries) {
      for (const lang of [...routing.locales, 'x-default']) {
        expect(entry).toContain(`hreflang="${lang}"`)
      }
    }
  })

  test('dates the changelog page from the seeded demo entries', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    const changelog = xml.split('<url>').find((entry) => entry.includes('/changelog</loc>'))
    expect(changelog).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}T/)
  })
})

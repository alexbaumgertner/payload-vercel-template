import { expect, test } from '@playwright/test'

test.describe('GET /api/health', () => {
  test('reports the app and database as up, uncached', async ({ request }) => {
    const response = await request.get('/api/health', { maxRedirects: 0 })

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(response.headers()['cache-control']).toBe('no-store')

    const body = await response.json()
    expect(Object.keys(body).sort()).toEqual(['checkedAt', 'commit', 'db', 'ok'])
    expect(body).toMatchObject({ ok: true, db: 'up', commit: 'local' })
    expect(Date.parse(body.checkedAt)).not.toBeNaN()
  })

  test('is served by our route, not localized and not Payload’s REST catch-all', async ({
    request,
  }) => {
    // Payload's `api/[...slug]` would answer an unknown collection with 404; the locale proxy
    // would redirect. Neither may happen.
    const response = await request.get('/api/health', {
      maxRedirects: 0,
      headers: { 'accept-language': 'ru' },
    })
    expect(response.status()).toBe(200)
    expect(response.url()).toMatch(/\/api\/health$/)
    expect(await response.json()).not.toHaveProperty('errors')
  })
})

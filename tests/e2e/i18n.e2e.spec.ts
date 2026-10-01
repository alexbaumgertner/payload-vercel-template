import { expect, test, type Page } from '@playwright/test'

import { seedChangelogEntry } from '../helpers/seedChangelog'

const alternates = (page: Page) =>
  page
    .locator('link[rel="alternate"][hreflang]')
    .evaluateAll((links) =>
      links.map((link) => [
        link.getAttribute('hreflang'),
        new URL(link.getAttribute('href') ?? '').pathname,
      ]),
    )

test.describe('English (default locale)', () => {
  test('keeps unprefixed URLs, lang="en" and hreflang alternates', async ({ page }) => {
    await page.goto('/changelog')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible()
    expect(await alternates(page)).toEqual([
      ['en', '/changelog'],
      ['ru', '/ru/changelog'],
      ['x-default', '/changelog'],
    ])
  })

  test('/en redirects to the single unprefixed URL', async ({ page }) => {
    await page.goto('/en/changelog')
    await expect(page).toHaveURL(/\/changelog$/)
    expect(new URL(page.url()).pathname).toBe('/changelog')
  })
})

test.describe('Russian', () => {
  test('renders the landing page in Russian with lang="ru"', async ({ page }) => {
    await page.goto('/ru')

    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Запустите SaaS на этих выходных, а не в следующем квартале.',
    )
    await expect(page.getByRole('link', { name: 'Изменения' }).first()).toHaveAttribute(
      'href',
      '/ru/changelog',
    )
    expect(await alternates(page)).toEqual([
      ['en', '/'],
      ['ru', '/ru'],
      ['x-default', '/'],
    ])
  })

  test('fits the longer Russian header on a 320px phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('/ru')

    const header = page.getByRole('banner')
    const bounds = await header.evaluate((banner) => {
      const nav = banner.querySelector('nav ul')
      const items = [...banner.querySelectorAll('a')].map((a) => a.getBoundingClientRect())
      return {
        pageScrolls: document.documentElement.scrollWidth > window.innerWidth,
        navClipped: nav ? nav.scrollWidth > nav.clientWidth : true,
        offscreen: items.filter((r) => r.left < 0 || r.right > window.innerWidth).length,
      }
    })
    expect(bounds).toEqual({ pageScrolls: false, navClipped: false, offscreen: 0 })
  })

  test('validates the waitlist form in Russian', async ({ page }) => {
    await page.goto('/ru')

    await page.getByPlaceholder('you@company.com').fill('not-an-email')
    await page.getByRole('button', { name: 'Записаться в лист ожидания' }).click()

    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      'Введите корректный адрес электронной почты.',
    )
  })

  test('confirms a waitlist signup in Russian', async ({ page }, testInfo) => {
    await page.goto('/ru')

    await page
      .getByPlaceholder('you@company.com')
      .fill(`i18n-${testInfo.project.name}-${Date.now()}@example.com`)
    await page.getByRole('button', { name: 'Записаться в лист ожидания' }).click()

    await expect(page.getByRole('main').getByRole('status')).toHaveText(
      'Вы в списке. Напишем, когда будет что показать.',
    )
  })

  test('shows translated changelog content and falls back to English', async ({
    page,
  }, testInfo) => {
    const id = `${testInfo.project.name}-${Date.now()}`
    const cleanups = [
      await seedChangelogEntry(
        { title: `Translated ${id}`, summary: 'English summary' },
        { title: `Переведено ${id}`, summary: 'Русское описание' },
      ),
      await seedChangelogEntry({ title: `English only ${id}`, summary: `Not translated ${id}` }),
    ]
    try {
      await page.goto('/ru/changelog')
      await expect(page.getByRole('heading', { level: 1, name: 'Изменения' })).toBeVisible()
      await expect(page.getByRole('heading', { name: `Переведено ${id}` })).toBeVisible()
      await expect(page.getByRole('heading', { name: `English only ${id}` })).toBeVisible()
      await expect(page.getByText(`Not translated ${id}`)).toBeVisible()

      // Visiting /ru stores the locale cookie, which would redirect /changelog back to /ru.
      await page.context().clearCookies()
      await page.goto('/changelog')
      await expect(page.getByRole('heading', { name: `Translated ${id}` })).toBeVisible()
      await expect(page.getByText('Русское описание')).toHaveCount(0)
    } finally {
      await Promise.all(cleanups.map((cleanup) => cleanup()))
    }
  })

  test('renders a Russian 404 for unknown pages', async ({ page }) => {
    const response = await page.goto('/ru/no-such-page')

    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible()
  })
})

test.describe('language switcher', () => {
  test('switches to the same page in the other language and remembers the choice', async ({
    page,
  }) => {
    await page.goto('/changelog')
    const switcher = page.getByRole('group', { name: 'Language' })
    await expect(switcher.getByRole('link', { name: 'English' })).toHaveAttribute(
      'aria-current',
      'true',
    )

    await switcher.getByRole('link', { name: 'Русский' }).click()
    await expect(page).toHaveURL(/\/ru\/changelog$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Изменения' })).toBeVisible()

    await page.goto('/')
    await expect(page).toHaveURL(/\/ru$/)

    await page.getByRole('group', { name: 'Язык' }).getByRole('link', { name: 'English' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    expect(new URL(page.url()).pathname).toBe('/')
  })
})

test.describe('locale negotiation', () => {
  test('a Russian browser landing on / is sent to /ru', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'ru-RU' })
    const page = await context.newPage()
    await page.goto('/')
    expect(new URL(page.url()).pathname).toBe('/ru')
    await context.close()
  })

  test('an unsupported browser language falls back to English', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'de-DE' })
    const page = await context.newPage()
    await page.goto('/')
    expect(new URL(page.url()).pathname).toBe('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await context.close()
  })

  test('an unknown locale prefix is a 404, not a new language', async ({ page }) => {
    const response = await page.goto('/de/changelog')
    expect(response?.status()).toBe(404)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})

test('the Payload admin and API stay outside locale routing', async ({ page, request }) => {
  await page.goto('/admin/login')
  expect(new URL(page.url()).pathname).toBe('/admin/login')
  expect((await request.get('/api/changelog?limit=1')).status()).toBe(200)
  expect((await request.get('/ru/admin', { maxRedirects: 0 })).status()).toBe(404)
})

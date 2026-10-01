import { render as rtlRender, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'

import { ChangelogList } from '@/components/ChangelogList/ChangelogList'
import type { Locale } from '@/i18n/routing'
import type { Changelog } from '@/payload-types'

import en from '../../messages/en.json'
import ru from '../../messages/ru.json'

const render = (ui: ReactElement, locale: Locale = 'en') =>
  rtlRender(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ru}>
      {ui}
    </NextIntlClientProvider>,
  )

const entry = (overrides: Partial<Changelog>): Changelog => ({
  id: 1,
  title: 'Entry',
  tag: 'feature',
  summary: 'Summary',
  publishedAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
})

describe('ChangelogList', () => {
  it('shows an empty state with a way forward when nothing is published', () => {
    render(<ChangelogList entries={[]} />)
    expect(screen.getByText('No releases yet')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'admin panel' }).getAttribute('href')).toBe(
      '/admin/collections/changelog',
    )
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('renders entries in the given order with date and tag', () => {
    render(
      <ChangelogList
        entries={[
          entry({ id: 2, title: 'Newer', publishedAt: '2026-09-20T00:00:00.000Z', tag: 'fix' }),
          entry({ id: 1, title: 'Older' }),
        ]}
      />,
    )
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['Newer', 'Older'])
    expect(screen.getByText('fix')).toBeTruthy()
    expect(screen.getAllByRole('listitem')[0]?.querySelector('time')?.dateTime).toBe(
      '2026-09-20T00:00:00.000Z',
    )
  })

  it('translates the empty state, tags and dates in Russian', () => {
    const empty = within(render(<ChangelogList entries={[]} />, 'ru').container)
    expect(empty.getByText('Релизов пока нет')).toBeTruthy()
    expect(empty.getByRole('link', { name: 'админке' })).toBeTruthy()

    const list = within(render(<ChangelogList entries={[entry({ tag: 'fix' })]} />, 'ru').container)
    expect(list.getByText('исправление')).toBeTruthy()
    expect(list.getByRole('listitem').querySelector('time')?.textContent).toMatch(/сент/)
  })
})

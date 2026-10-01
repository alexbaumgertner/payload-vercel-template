import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ChangelogList } from '@/components/ChangelogList/ChangelogList'
import type { Changelog } from '@/payload-types'

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
})

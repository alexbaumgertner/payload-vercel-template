import { describe, expect, it } from 'vitest'

import { formatDate } from '@/lib/format'

describe('formatDate', () => {
  it('formats ISO strings in UTC', () => {
    expect(formatDate('2026-09-30T23:30:00.000Z')).toBe('Sep 30, 2026')
  })

  it('accepts Date instances', () => {
    expect(formatDate(new Date(Date.UTC(2026, 0, 5)))).toBe('Jan 5, 2026')
  })
})

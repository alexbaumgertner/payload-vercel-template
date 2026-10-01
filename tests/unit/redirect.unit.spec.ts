import { describe, expect, it } from 'vitest'

import { safeRedirect } from '@/features/auth/redirect'

describe('safeRedirect after login', () => {
  it.each([
    ['/admin', '/admin'],
    ['/admin/collections/changelog?limit=10#top', '/admin/collections/changelog?limit=10#top'],
    ['/admin/../admin/account', '/admin/account'],
  ])('keeps same-origin path %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected)
  })

  it.each([
    ['https://evil.example/phish', 'absolute URL'],
    ['//evil.example', 'protocol-relative URL'],
    ['/\\evil.example', 'backslash that browsers read as //'],
    ['/\t/evil.example', 'tab inside the slashes'],
    ['javascript:alert(1)', 'javascript: URL'],
    ['admin', 'relative path'],
    ['', 'empty value'],
    [null, 'missing value'],
  ])('falls back to /admin for %s (%s)', (input: string | null, _reason: string) => {
    expect(safeRedirect(input)).toBe('/admin')
  })
})

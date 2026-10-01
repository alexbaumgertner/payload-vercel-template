import { describe, expect, it } from 'vitest'

import { waitlistSchema } from '@/features/waitlist/schema'

describe('waitlistSchema', () => {
  it('normalizes email to trimmed lowercase', () => {
    const result = waitlistSchema.parse({ email: '  Founder@Example.COM ' })
    expect(result.email).toBe('founder@example.com')
  })

  it.each(['', 'not-an-email', 'a@b', '@example.com'])('rejects invalid email %j', (email) => {
    const result = waitlistSchema.safeParse({ email })
    expect(result.success).toBe(false)
  })

  it('rejects submissions with a filled honeypot', () => {
    const result = waitlistSchema.safeParse({ email: 'bot@example.com', company: 'Spam Inc' })
    expect(result.success).toBe(false)
  })

  it.each([
    ['empty', ''],
    ['longer than 254 characters', `${'a'.repeat(60)}@${'b'.repeat(200)}.com`],
  ])('rejects an %s email', (_label, email) => {
    expect(waitlistSchema.safeParse({ email }).success).toBe(false)
  })

  it('rejects a source longer than 64 characters', () => {
    expect(
      waitlistSchema.safeParse({ email: 'a@example.com', source: 'x'.repeat(65) }).success,
    ).toBe(false)
  })

  it('accepts an optional source', () => {
    const result = waitlistSchema.parse({ email: 'a@example.com', source: 'landing-hero' })
    expect(result.source).toBe('landing-hero')
  })
})

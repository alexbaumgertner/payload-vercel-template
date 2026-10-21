// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { buildHealth, commitLabel, withTimeout } from '@/lib/health'

const now = new Date('2026-10-20T10:00:00.000Z')

describe('buildHealth', () => {
  it('is 200 and ok when the database answered', () => {
    expect(buildHealth({ dbUp: true, commit: 'abc1234', now })).toEqual({
      status: 200,
      body: { ok: true, db: 'up', commit: 'abc1234', checkedAt: '2026-10-20T10:00:00.000Z' },
    })
  })

  it('is 503 and not ok when the database did not', () => {
    expect(buildHealth({ dbUp: false, commit: 'local', now })).toEqual({
      status: 503,
      body: { ok: false, db: 'down', commit: 'local', checkedAt: '2026-10-20T10:00:00.000Z' },
    })
  })

  it('exposes nothing but the four fields', () => {
    expect(Object.keys(buildHealth({ dbUp: true, commit: 'local', now }).body).sort()).toEqual([
      'checkedAt',
      'commit',
      'db',
      'ok',
    ])
  })
})

describe('commitLabel', () => {
  it('shortens the Vercel commit SHA to seven characters', () => {
    expect(commitLabel({ VERCEL_GIT_COMMIT_SHA: '0123456789abcdef' })).toBe('0123456')
  })

  it('is "local" outside Vercel', () => {
    expect(commitLabel({})).toBe('local')
    expect(commitLabel({ VERCEL_GIT_COMMIT_SHA: '' })).toBe('local')
  })
})

describe('withTimeout', () => {
  it('passes a fast result through', async () => {
    await expect(withTimeout(Promise.resolve(3), 50)).resolves.toBe(3)
  })

  it('rejects a hanging promise', async () => {
    await expect(withTimeout(new Promise(() => undefined), 10)).rejects.toThrow(/timed out/)
  })
})

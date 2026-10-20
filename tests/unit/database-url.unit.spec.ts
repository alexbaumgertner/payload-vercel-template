// @vitest-environment node
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { describeDatabase, selectDatabaseUrl, withStrictSsl } from '@/lib/database-url'

// The order is not taste: on Vercel the Neon integration puts the preview branch into
// DATABASE_URL while POSTGRES_URL can still point at production.
const PROD = 'postgresql://u:secret-pw@ep-prod-main.eu-central-1.aws.neon.tech/neondb'
const PREVIEW = 'postgresql://u:secret-pw@ep-preview-feat.eu-central-1.aws.neon.tech/neondb'
const LOCAL = 'postgresql://app:app@127.0.0.1:5432/app'

const hostPrint = (url: string) =>
  createHash('sha256').update(new URL(url).hostname).digest('hex').slice(0, 8)

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('selectDatabaseUrl', () => {
  it('prefers the preview branch in DATABASE_URL over the shared POSTGRES_URL', () => {
    expect(selectDatabaseUrl({ DATABASE_URL: PREVIEW, POSTGRES_URL: PROD })).toEqual({
      source: 'DATABASE_URL',
      url: PREVIEW,
    })
  })

  it('lets a hand-set DATABASE_URI win over both', () => {
    expect(
      selectDatabaseUrl({ DATABASE_URI: LOCAL, DATABASE_URL: PREVIEW, POSTGRES_URL: PROD }),
    ).toEqual({ source: 'DATABASE_URI', url: LOCAL })
  })

  it('falls back to POSTGRES_URL alone', () => {
    expect(selectDatabaseUrl({ POSTGRES_URL: PROD })?.source).toBe('POSTGRES_URL')
  })

  it('skips blank values and returns null when nothing is set', () => {
    expect(selectDatabaseUrl({ DATABASE_URI: '  ', DATABASE_URL: PREVIEW })?.source).toBe(
      'DATABASE_URL',
    )
    expect(selectDatabaseUrl({})).toBeNull()
  })
})

describe('withStrictSsl', () => {
  it.each(['require', 'prefer', 'verify-ca'])('upgrades sslmode=%s to verify-full', (mode) => {
    expect(withStrictSsl(`postgresql://u:p@db.example.com/main?sslmode=${mode}`)).toContain(
      'sslmode=verify-full',
    )
  })

  it.each(['verify-full', 'disable', 'no-verify'])('keeps sslmode=%s', (mode) => {
    expect(withStrictSsl(`postgresql://u:p@db.example.com/main?sslmode=${mode}`)).toContain(
      `sslmode=${mode}`,
    )
  })

  it('leaves a local URL without sslmode byte-for-byte untouched', () => {
    expect(withStrictSsl(LOCAL)).toBe(LOCAL)
  })

  it('keeps the other parameters', () => {
    const url = withStrictSsl(
      'postgresql://u:p@db.example.com/main?sslmode=require&channel_binding=require',
    )
    expect(url).toContain('channel_binding=require')
    expect(url).toContain('sslmode=verify-full')
  })

  it('applies to the selected URL', () => {
    expect(selectDatabaseUrl({ DATABASE_URL: `${PROD}?sslmode=require` })?.url).toContain(
      'sslmode=verify-full',
    )
  })
})

describe('describeDatabase / announceDatabase', () => {
  it('shows host, database and a host fingerprint, never credentials', () => {
    const line = describeDatabase(PREVIEW)
    expect(line).toContain('ep-preview-feat.eu-central-1.aws.neon.tech/neondb')
    expect(line).toContain(`fingerprint ${hostPrint(PREVIEW)}`)
    expect(line).not.toContain('secret-pw')
    expect(line).not.toContain('u:')
  })

  it('gives different fingerprints for different hosts, the same for the same host', () => {
    expect(hostPrint(PREVIEW.replace('/neondb', '/other'))).toBe(hostPrint(PREVIEW))
    expect(hostPrint(PROD)).not.toBe(hostPrint(PREVIEW))
  })

  it('logs the source name once per process', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const { announceDatabase } = await import('@/lib/database-url')
    const env = { DATABASE_URL: PREVIEW, POSTGRES_URL: PROD }
    announceDatabase(env)
    announceDatabase(env)
    expect(info).toHaveBeenCalledTimes(1)
    const line = String(info.mock.calls[0]?.[0])
    expect(line).toContain('DATABASE_URL')
    expect(line).toContain('ep-preview-feat')
    expect(line).not.toContain('secret-pw')
  })
})

// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  assertDevDatabaseIsLocal,
  assertLocalDatabaseForScript,
  canSeed,
  isLocalDatabaseUrl,
  shouldPushSchema,
} from '@/lib/database-target'

const LOCAL = 'postgresql://app:app@127.0.0.1:5432/app'
const REMOTE = 'postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb'

describe('isLocalDatabaseUrl', () => {
  it.each([
    'postgresql://app:app@localhost:5432/app',
    'postgres://u:p@127.0.0.1/db',
    'postgres://u:p@[::1]:5432/db',
    'postgres://u:p@postgres:5432/db',
    'postgres://u:p@host.docker.internal/db',
  ])('accepts %s', (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(true)
  })

  it.each([REMOTE, 'postgres://u:p@localhost.evil.example/db', 'not a url', undefined])(
    'rejects %s',
    (url) => {
      expect(isLocalDatabaseUrl(url)).toBe(false)
    },
  )
})

describe('shouldPushSchema', () => {
  it('pushes into a local database when requested', () => {
    expect(shouldPushSchema(true, { DATABASE_URL: LOCAL })).toBe(true)
    expect(shouldPushSchema(false, { DATABASE_URL: LOCAL })).toBe(false)
  })

  it('never pushes into a remote database, not even with ALLOW_REMOTE_DATABASE', () => {
    expect(shouldPushSchema(true, { DATABASE_URL: REMOTE })).toBe(false)
    expect(shouldPushSchema(true, { DATABASE_URL: REMOTE, ALLOW_REMOTE_DATABASE: '1' })).toBe(false)
  })

  it('never pushes in production', () => {
    expect(shouldPushSchema(true, { DATABASE_URL: LOCAL, NODE_ENV: 'production' })).toBe(false)
  })
})

describe('assertDevDatabaseIsLocal', () => {
  it('refuses a remote database outside Vercel — the `vercel env pull` → `pnpm dev` accident', () => {
    expect(() => assertDevDatabaseIsLocal({ DATABASE_URL: REMOTE })).toThrow(
      /remote database ep-x-pooler\.eu-central-1\.aws\.neon\.tech/,
    )
    expect(() =>
      assertDevDatabaseIsLocal({ DATABASE_URL: REMOTE, NODE_ENV: 'development' }),
    ).toThrow()
  })

  it('does not trust NODE_ENV=production alone (some shells export it)', () => {
    expect(() =>
      assertDevDatabaseIsLocal({ DATABASE_URL: REMOTE, NODE_ENV: 'production' }),
    ).toThrow()
  })

  it('never shows credentials in the error', () => {
    expect(() => assertDevDatabaseIsLocal({ DATABASE_URL: REMOTE })).not.toThrow(/u:p/)
  })

  it('allows a local database, a deliberate opt-in, and Vercel builds and functions', () => {
    expect(() => assertDevDatabaseIsLocal({ DATABASE_URL: LOCAL })).not.toThrow()
    expect(() =>
      assertDevDatabaseIsLocal({ DATABASE_URL: REMOTE, ALLOW_REMOTE_DATABASE: '1' }),
    ).not.toThrow()
    expect(() => assertDevDatabaseIsLocal({ DATABASE_URL: REMOTE, VERCEL: '1' })).not.toThrow()
    expect(() =>
      assertDevDatabaseIsLocal({ DATABASE_URL: REMOTE, VERCEL_ENV: 'production' }),
    ).not.toThrow()
  })

  it('only accepts the literal 1 as an opt-in', () => {
    expect(() =>
      assertDevDatabaseIsLocal({ DATABASE_URL: REMOTE, ALLOW_REMOTE_DATABASE: 'true' }),
    ).toThrow()
  })
})

describe('assertLocalDatabaseForScript', () => {
  it('refuses a remote database without the opt-in, even on Vercel', () => {
    expect(() => assertLocalDatabaseForScript('create-admin', { DATABASE_URL: REMOTE })).toThrow(
      /create-admin refuses to run against remote database/,
    )
    expect(() =>
      assertLocalDatabaseForScript('create-admin', { DATABASE_URL: REMOTE, VERCEL: '1' }),
    ).toThrow()
  })

  it('allows a local database and the explicit opt-in', () => {
    expect(() =>
      assertLocalDatabaseForScript('create-admin', { DATABASE_URL: LOCAL }),
    ).not.toThrow()
    expect(() =>
      assertLocalDatabaseForScript('create-admin', {
        DATABASE_URL: REMOTE,
        ALLOW_REMOTE_DATABASE: '1',
      }),
    ).not.toThrow()
  })
})

describe('canSeed', () => {
  it('runs against a local database', () => {
    expect(canSeed({ DATABASE_URL: LOCAL })).toBe(true)
  })

  it('runs on a Vercel Preview build (a throwaway Neon branch)', () => {
    expect(canSeed({ DATABASE_URL: REMOTE, VERCEL: '1', VERCEL_ENV: 'preview' })).toBe(true)
  })

  it('refuses production and any other Vercel environment', () => {
    expect(canSeed({ DATABASE_URL: REMOTE, VERCEL: '1', VERCEL_ENV: 'production' })).toBe(false)
    expect(canSeed({ DATABASE_URL: LOCAL, VERCEL_ENV: 'development' })).toBe(false)
  })

  it('refuses a remote database locally, with no override', () => {
    expect(canSeed({ DATABASE_URL: REMOTE })).toBe(false)
    expect(canSeed({ DATABASE_URL: REMOTE, ALLOW_REMOTE_DATABASE: '1' })).toBe(false)
    expect(canSeed({})).toBe(false)
  })
})

import config from '@payload-config'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { packDump } from '@/lib/backup/crypto'
import { createDump, type Dump } from '@/lib/backup/dump'

// A copy nobody has restored is a hope, not a backup: this test dumps the test database,
// encrypts it, and restores it with the real script into a fresh, empty database.

let payload: Payload
let dump: Dump
let file: string
let workDir: string
let restorePool: Payload['db']['pool']

const key = randomBytes(32)
const context = { disableRevalidate: true }
const suffix = randomBytes(4).toString('hex')
const sourceUrl = new URL(process.env.DATABASE_URL ?? '')
const restoreName = `${sourceUrl.pathname.slice(1)}_restore_${suffix}`
const restoreUrl = Object.assign(new URL(sourceUrl.href), { pathname: `/${restoreName}` }).href

function restore() {
  // The child resolves DATABASE_URL like the app does: no URI or POSTGRES_URL may win over it.
  const { DATABASE_URI: _uri, POSTGRES_URL: _pg, ...env } = process.env
  return spawnSync('pnpm', ['exec', 'tsx', 'scripts/backup-restore.ts', file], {
    encoding: 'utf8',
    timeout: 180_000,
    env: {
      ...env,
      DATABASE_URL: restoreUrl,
      BACKUP_KEY: key.toString('base64'),
      PAYLOAD_DB_PUSH: 'true',
      NODE_OPTIONS: '--no-deprecation',
    },
  })
}

describe('backup → restore round trip', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })

    await payload.create({ collection: 'users', data: { email: `backup-${suffix}@example.com` } })
    await payload.create({
      collection: 'waitlist-signups',
      data: { email: `wait-${suffix}@example.com`, source: 'landing' },
    })
    const entry = await payload.create({
      collection: 'changelog',
      locale: 'en',
      context,
      data: {
        title: `Backup ${suffix}`,
        tag: 'feature',
        summary: 'English',
        publishedAt: new Date().toISOString(),
      },
    })
    await payload.update({
      collection: 'changelog',
      id: entry.id,
      locale: 'ru',
      context,
      data: { title: `Копия ${suffix}`, summary: 'Русский' },
    })

    const client = await payload.db.pool.connect()
    try {
      dump = await createDump(client, sourceUrl.href)
    } finally {
      client.release()
    }
    workDir = mkdtempSync(path.join(tmpdir(), 'backup-int-'))
    file = path.join(workDir, 'copy.json.gz.enc')
    writeFileSync(file, packDump(dump, key))

    await payload.db.pool.query(`CREATE DATABASE "${restoreName}"`)
    const PoolClass = payload.db.pool.constructor as new (options: {
      connectionString: string
    }) => Payload['db']['pool']
    restorePool = new PoolClass({ connectionString: restoreUrl })
  }, 120_000)

  afterAll(async () => {
    await restorePool?.end()
    await payload.db.pool.query(`DROP DATABASE IF EXISTS "${restoreName}" WITH (FORCE)`)
    rmSync(workDir, { recursive: true, force: true })
    await payload.delete({
      collection: 'changelog',
      where: { title: { equals: `Backup ${suffix}` } },
      context,
    })
    await payload.delete({
      collection: 'waitlist-signups',
      where: { email: { equals: `wait-${suffix}@example.com` } },
    })
    await payload.delete({
      collection: 'users',
      where: { email: { equals: `backup-${suffix}@example.com` } },
    })
    await payload.destroy()
  }, 60_000)

  it('leaves short-lived tables out of the copy', () => {
    const names = dump.tables.map((table) => table.name)
    expect(names).toEqual(expect.arrayContaining(['users', 'changelog', 'changelog_locales']))
    for (const skipped of ['auth_codes', 'users_sessions', 'payload_migrations', 'payload_kv']) {
      expect(names).not.toContain(skipped)
    }
  })

  it('restores every table with the same row counts and resets sequences', async () => {
    const result = restore()
    expect(result.stderr).not.toMatch(/failed/)
    expect(result.status).toBe(0)

    for (const table of dump.tables) {
      const { rows } = await restorePool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "${table.name}"`,
      )
      expect({ table: table.name, rows: rows[0]?.n }).toEqual({
        table: table.name,
        rows: table.rows.length,
      })
    }

    const { rows: translated } = await restorePool.query<{ title: string }>(
      `SELECT title FROM changelog_locales WHERE _locale = 'ru' AND title = $1`,
      [`Копия ${suffix}`],
    )
    expect(translated).toHaveLength(1)

    const users = dump.sequences.find((sequence) => sequence.name === 'users_id_seq')
    const { rows: sequence } = await restorePool.query<{ value: string }>(
      'SELECT last_value::text AS value FROM users_id_seq',
    )
    expect(sequence[0]?.value).toBe(users?.value)
  }, 200_000)

  it('refuses to restore into a database that already has rows', async () => {
    const before = await restorePool.query<{ n: number }>('SELECT count(*)::int AS n FROM users')
    const result = restore()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/is not empty; restore only into an empty database/)
    const after = await restorePool.query<{ n: number }>('SELECT count(*)::int AS n FROM users')
    expect(after.rows[0]?.n).toBe(before.rows[0]?.n)
  }, 200_000)
})

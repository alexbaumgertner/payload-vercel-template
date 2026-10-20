// @vitest-environment node
import { randomBytes } from 'node:crypto'
import type { SendEmailOptions } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { backupFileName, backupKey, packDump, unpackDump } from '@/lib/backup/crypto'
import { type Dump, orderTables, type Queryable, summarize } from '@/lib/backup/dump'
import { type BackupDeps, MAX_ATTACHMENT_BYTES, runBackup } from '@/lib/backup/run'
import type { SendMailResult } from '@/lib/mail-gate'

const key = randomBytes(32)

const dump: Dump = {
  version: 1,
  createdAt: '2026-10-20T03:00:12.000Z',
  source: 'abcd1234',
  tables: [
    { name: 'changelog', rows: [{ id: 7, title: 'Кириллица и ümlaut', meta: { tags: [1, 2] } }] },
    { name: 'users', rows: [{ id: 1, email: 'owner@example.com' }] },
    { name: 'waitlist_signups', rows: [] },
  ],
  sequences: [{ name: 'changelog_id_seq', value: '7' }],
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('orderTables', () => {
  it('puts parents before children', () => {
    const order = orderTables(
      [
        'changelog_locales',
        'payload_preferences_rels',
        'changelog',
        'users',
        'payload_preferences',
      ],
      [
        { child: 'changelog_locales', parent: 'changelog' },
        { child: 'payload_preferences_rels', parent: 'payload_preferences' },
        { child: 'payload_preferences_rels', parent: 'users' },
      ],
    )
    expect(order.indexOf('changelog')).toBeLessThan(order.indexOf('changelog_locales'))
    expect(order.indexOf('users')).toBeLessThan(order.indexOf('payload_preferences_rels'))
    expect(order.indexOf('payload_preferences')).toBeLessThan(
      order.indexOf('payload_preferences_rels'),
    )
  })

  it('ignores self references and keeps a cycle instead of dropping tables', () => {
    const order = orderTables(
      ['a', 'b', 'c'],
      [
        { child: 'a', parent: 'a' },
        { child: 'b', parent: 'c' },
        { child: 'c', parent: 'b' },
      ],
    )
    expect(order[0]).toBe('a')
    expect([...order].sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('packDump / unpackDump', () => {
  it('round-trips a dump, including non-ASCII text and JSON arrays', () => {
    expect(unpackDump(packDump(dump, key), key)).toEqual(dump)
  })

  it('rejects a wrong key and a tampered file', () => {
    const file = packDump(dump, key)
    expect(() => unpackDump(file, randomBytes(32))).toThrow()
    const tampered = Buffer.from(file)
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1
    expect(() => unpackDump(tampered, key)).toThrow()
  })

  it('contains no plaintext, not even compressed', () => {
    const file = packDump(dump, key)
    expect(file.includes(Buffer.from('owner@example.com'))).toBe(false)
    expect(file.subarray(28, 30).equals(Buffer.from([0x1f, 0x8b]))).toBe(false)
  })

  it('uses a fresh IV per copy', () => {
    expect(packDump(dump, key).subarray(0, 12)).not.toEqual(packDump(dump, key).subarray(0, 12))
  })
})

describe('backupKey', () => {
  it('is null when unset and rejects a key that is not 32 bytes', () => {
    expect(backupKey({})).toBeNull()
    expect(backupKey({ BACKUP_KEY: '  ' })).toBeNull()
    expect(() => backupKey({ BACKUP_KEY: randomBytes(16).toString('base64') })).toThrow(/32 bytes/)
    expect(backupKey({ BACKUP_KEY: key.toString('base64') })).toEqual(key)
  })
})

describe('summary and file name', () => {
  it('lists non-empty tables and a date-stamped, slugged file name', () => {
    expect(summarize(dump)).toBe('Rows: 2\n  changelog: 1\n  users: 1\nSequences: 1')
    expect(backupFileName('Indie Starter', dump.createdAt)).toBe(
      'indie-starter-2026-10-20.json.gz.enc',
    )
  })
})

/** A fake pool client that answers the dump queries with two small tables. */
function fakeClient(rowsPerTable = 1, payloadBytes = 10) {
  const client: Queryable & { release: () => void } = {
    release: vi.fn(),
    query: vi.fn(async (text: string) => {
      if (text.includes('information_schema.tables')) {
        return { rows: [{ table_name: 'auth_codes' }, { table_name: 'users' }] }
      }
      if (text.includes('pg_sequences')) {
        return { rows: [{ name: 'users_id_seq', table: 'users', value: '1' }] }
      }
      if (text.startsWith('SELECT * FROM')) {
        return {
          rows: Array.from({ length: rowsPerTable }, (_, id) => ({
            id,
            // Random, so gzip can't shrink it below the size cap.
            blob: randomBytes(payloadBytes).toString('base64'),
          })),
        }
      }
      return { rows: [] }
    }) as Queryable['query'],
  }
  return client
}

const configured = {
  BACKUP_EMAIL: 'owner@example.com',
  CRON_SECRET: 'cron-secret-long-enough',
  BACKUP_KEY: key.toString('base64'),
  DATABASE_URL: 'postgresql://u:p@db.example.com/app',
}

function setup(client = fakeClient(), sendResult: SendMailResult = { sent: true }) {
  const connect = vi.fn(async () => client)
  const send = vi.fn(async (_message: SendEmailOptions) => sendResult)
  const deps: BackupDeps = {
    connect,
    send,
    siteName: 'Indie Starter',
    now: () => new Date('2026-10-20T03:00:00.000Z'),
  }
  return { client, connect, send, deps }
}

describe('runBackup', () => {
  it.each([
    ['nothing set', {}],
    ['no BACKUP_EMAIL', { ...configured, BACKUP_EMAIL: undefined }],
    ['no CRON_SECRET', { ...configured, CRON_SECRET: undefined }],
    ['blank values', { ...configured, BACKUP_EMAIL: ' ', CRON_SECRET: ' ' }],
  ])('is a no-op when not configured (%s): no database, no mail', async (_label, env) => {
    const { deps: d, connect, send } = setup()
    await expect(runBackup(d, env)).resolves.toEqual({
      status: 'skipped',
      reason: 'not_configured',
    })
    expect(connect).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('mails an encrypted copy that the key opens, without skipped tables', async () => {
    const { deps: d, client, send } = setup()
    const outcome = await runBackup(d, configured)
    expect(outcome).toMatchObject({ status: 'sent', rows: 1 })
    expect(client.release).toHaveBeenCalledOnce()

    const message = send.mock.calls[0]?.[0]
    expect(message).toMatchObject({
      to: 'owner@example.com',
      subject: 'Indie Starter backup 2026-10-20',
    })
    const attachment = message?.attachments?.[0]
    expect(attachment?.filename).toBe('indie-starter-2026-10-20.json.gz.enc')
    const restored = unpackDump(Buffer.from(String(attachment?.content), 'base64'), key)
    expect(restored.tables.map((table) => table.name)).toEqual(['users'])
    expect(restored.source).toMatch(/^[0-9a-f]{8}$/)
  })

  it.each([
    ['missing', undefined, /refusing to mail an unencrypted copy/],
    ['malformed', 'short', /32 bytes/],
  ])(
    'refuses with a %s BACKUP_KEY: "NOT made" mail, no attachment, no dump',
    async (_label, BACKUP_KEY, reason) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const { deps: d, connect, send } = setup()
      const outcome = await runBackup(d, { ...configured, BACKUP_KEY })
      expect(outcome).toMatchObject({ status: 'failed', error: expect.stringMatching(reason) })
      expect(connect).not.toHaveBeenCalled()
      expect(send).toHaveBeenCalledOnce()
      const message = send.mock.calls[0]?.[0]
      expect(message?.subject).toContain('backup NOT made')
      expect(message?.attachments).toBeUndefined()
    },
  )

  it('reports a database failure by mail and releases the client', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const client = fakeClient()
    client.query = vi.fn(async () => {
      throw new Error('connection reset')
    }) as Queryable['query']
    const { deps: d, send } = setup(client)
    await expect(runBackup(d, configured)).resolves.toMatchObject({ status: 'failed' })
    expect(client.release).toHaveBeenCalledOnce()
    expect(send.mock.calls[0]?.[0]?.text).toContain('connection reset')
  })

  it('refuses a copy over the size cap with a clear message instead of attaching it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const big = fakeClient(Math.ceil(MAX_ATTACHMENT_BYTES / 1_000_000) + 1, 1_000_000)
    const { deps: d, send } = setup(big)
    const outcome = await runBackup(d, configured)
    expect(outcome).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/over the 25 MB mail limit/),
    })
    expect(send).toHaveBeenCalledOnce()
    expect(send.mock.calls[0]?.[0]?.attachments).toBeUndefined()
  })

  it('treats a refused mail as a failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { deps: d } = setup(fakeClient(), { sent: false, reason: 'preview_deployment' })
    await expect(runBackup(d, configured)).resolves.toMatchObject({
      status: 'failed',
      error: expect.stringContaining('preview_deployment'),
    })
  })
})

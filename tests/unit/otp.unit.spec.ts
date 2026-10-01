import { describe, expect, it } from 'vitest'

import {
  BAD_CODE,
  BAD_EMAIL,
  CODE_RETENTION_MS,
  CODE_TTL_MS,
  MAIL_BROKEN,
  PER_EMAIL_WINDOW_MS,
  PER_IP_WINDOW_MS,
  TOO_MANY,
  requestCode,
  verifyCode,
  type CodeRecord,
  type OtpDeps,
  type OtpStore,
} from '@/features/auth/otp'

type Row = CodeRecord & {
  email: string
  requestIp: string
  createdAt: number
  expiresAt: number
  consumedAt?: number
}

function memoryStore(users: Record<string, number>, clock: () => number) {
  const rows: Row[] = []
  let nextId = 1
  const store: OtpStore = {
    async countCodesByEmailSince(email, since) {
      return rows.filter((r) => r.email === email && r.createdAt > since.getTime()).length
    },
    async countCodesByIpSince(ip, since) {
      return rows.filter((r) => r.requestIp === ip && r.createdAt > since.getTime()).length
    },
    async createCode(rec) {
      rows.push({
        id: nextId++,
        email: rec.email,
        codeHash: rec.codeHash,
        attempts: 0,
        delivered: rec.delivered,
        requestIp: rec.requestIp,
        createdAt: clock(),
        expiresAt: rec.expiresAt.getTime(),
      })
    },
    async latestActiveCode(email, now) {
      const active = rows.filter(
        (r) => r.email === email && r.consumedAt === undefined && r.expiresAt > now.getTime(),
      )
      return active.at(-1) ?? null
    },
    async updateCode(id, patch) {
      const row = rows.find((r) => r.id === id)
      if (!row) return
      if (patch.attempts !== undefined) row.attempts = patch.attempts
      if (patch.consumedAt) row.consumedAt = patch.consumedAt.getTime()
    },
    async purgeCodesCreatedBefore(cutoff) {
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (rows[i]!.createdAt < cutoff.getTime()) rows.splice(i, 1)
      }
    },
    async findUserId(email) {
      return users[email] ?? null
    },
  }
  return { store, rows }
}

function setup() {
  let t = Date.UTC(2026, 8, 30, 12)
  const clock = () => t
  const { store, rows } = memoryStore({ 'admin@example.com': 7 }, clock)
  const sent: Array<{ to: string; code: string }> = []
  let codeSeq = 100000
  const deps: OtpDeps = {
    store,
    secret: 'secret',
    now: clock,
    minResponseMs: 0,
    generateCode: () => String(codeSeq++),
    sendCode: async (to, code) => {
      sent.push({ to, code })
    },
  }
  return { deps, rows, sent, advance: (ms: number) => (t += ms) }
}

describe('requestCode', () => {
  it('emails a code to a known user and stores only its hash', async () => {
    const { deps, rows, sent } = setup()
    expect(await requestCode(' Admin@Example.com ', '1.1.1.1', deps)).toEqual({
      ok: true,
      email: 'admin@example.com',
    })
    expect(sent).toEqual([{ to: 'admin@example.com', code: '100000' }])
    expect(rows[0]?.codeHash).not.toContain('100000')
  })

  it('answers the same for unknown addresses but sends nothing', async () => {
    const { deps, sent } = setup()
    expect(await requestCode('stranger@example.com', '1.1.1.1', deps)).toEqual({
      ok: true,
      email: 'stranger@example.com',
    })
    expect(sent).toHaveLength(0)
  })

  it('rejects malformed emails', async () => {
    const { deps } = setup()
    expect(await requestCode('not-an-email', '1.1.1.1', deps)).toEqual({
      ok: false,
      error: BAD_EMAIL,
    })
  })

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['longer than 254 characters', `${'a'.repeat(60)}@${'b'.repeat(200)}.com`],
  ])('rejects an %s email without storing a code', async (_label, email) => {
    const { deps, rows, sent } = setup()
    expect(await requestCode(email, '1.1.1.1', deps)).toEqual({ ok: false, error: BAD_EMAIL })
    expect(rows).toHaveLength(0)
    expect(sent).toHaveLength(0)
  })

  it('limits codes per email', async () => {
    const { deps, advance } = setup()
    for (let i = 0; i < 3; i += 1) {
      expect((await requestCode('admin@example.com', `10.0.0.${i}`, deps)).ok).toBe(true)
    }
    expect(await requestCode('admin@example.com', '10.0.0.9', deps)).toEqual({
      ok: false,
      error: TOO_MANY,
    })
    advance(PER_EMAIL_WINDOW_MS + 1)
    expect((await requestCode('admin@example.com', '10.0.0.9', deps)).ok).toBe(true)
  })

  it('limits requests per IP across addresses', async () => {
    const { deps, advance } = setup()
    for (let i = 0; i < 20; i += 1) {
      await requestCode(`u${i}@example.com`, '2.2.2.2', deps)
    }
    expect(await requestCode('admin@example.com', '2.2.2.2', deps)).toEqual({
      ok: false,
      error: TOO_MANY,
    })
    advance(PER_IP_WINDOW_MS + 1)
    expect((await requestCode('admin@example.com', '2.2.2.2', deps)).ok).toBe(true)
  })

  it('reports a mail failure instead of pretending the code was sent', async () => {
    const { deps } = setup()
    deps.sendCode = async () => {
      throw new Error('resend down')
    }
    expect(await requestCode('admin@example.com', '1.1.1.1', deps)).toEqual({
      ok: false,
      error: MAIL_BROKEN,
    })
  })

  it('purges codes past retention, which outlives every rate-limit window', async () => {
    const { deps, rows, advance } = setup()
    await requestCode('admin@example.com', '1.1.1.1', deps)
    advance(CODE_RETENTION_MS + 1)
    await requestCode('admin@example.com', '1.1.1.1', deps)
    expect(rows).toHaveLength(1)
    expect(CODE_RETENTION_MS).toBeGreaterThan(Math.max(PER_EMAIL_WINDOW_MS, PER_IP_WINDOW_MS))
  })
})

describe('verifyCode', () => {
  it('signs a user in once with the right code', async () => {
    const { deps } = setup()
    await requestCode('admin@example.com', '1.1.1.1', deps)
    expect(await verifyCode('admin@example.com', '100 000', deps)).toEqual({ ok: true, userId: 7 })
    expect(await verifyCode('admin@example.com', '100000', deps)).toEqual({
      ok: false,
      error: BAD_CODE,
    })
  })

  it('only accepts the latest code', async () => {
    const { deps } = setup()
    await requestCode('admin@example.com', '1.1.1.1', deps)
    await requestCode('admin@example.com', '1.1.1.1', deps)
    expect((await verifyCode('admin@example.com', '100000', deps)).ok).toBe(false)
    expect((await verifyCode('admin@example.com', '100001', deps)).ok).toBe(true)
  })

  it('rejects expired codes', async () => {
    const { deps, advance } = setup()
    await requestCode('admin@example.com', '1.1.1.1', deps)
    advance(CODE_TTL_MS + 1)
    expect(await verifyCode('admin@example.com', '100000', deps)).toEqual({
      ok: false,
      error: BAD_CODE,
    })
  })

  it('burns the code after 5 wrong attempts, even if the 6th is right', async () => {
    const { deps } = setup()
    await requestCode('admin@example.com', '1.1.1.1', deps)
    for (let i = 0; i < 4; i += 1) {
      expect((await verifyCode('admin@example.com', '999999', deps)).ok).toBe(false)
    }
    expect(await verifyCode('admin@example.com', '999999', deps)).toEqual({
      ok: false,
      error: TOO_MANY,
    })
    expect((await verifyCode('admin@example.com', '100000', deps)).ok).toBe(false)
  })

  it('never signs in an unknown address, even with the stored code', async () => {
    const { deps } = setup()
    await requestCode('stranger@example.com', '1.1.1.1', deps)
    expect(await verifyCode('stranger@example.com', '100000', deps)).toEqual({
      ok: false,
      error: BAD_CODE,
    })
  })

  it('rejects malformed codes without spending an attempt', async () => {
    const { deps, rows } = setup()
    await requestCode('admin@example.com', '1.1.1.1', deps)
    expect((await verifyCode('admin@example.com', 'abc', deps)).ok).toBe(false)
    expect(rows[0]?.attempts).toBe(0)
  })

  it.each(['', '12345', '1000000', '10000a', '100000'.repeat(100)])(
    'rejects code %j without spending an attempt',
    async (code) => {
      const { deps, rows } = setup()
      await requestCode('admin@example.com', '1.1.1.1', deps)
      expect(await verifyCode('admin@example.com', code, deps)).toEqual({
        ok: false,
        error: BAD_CODE,
      })
      expect(rows[0]?.attempts).toBe(0)
    },
  )

  it('accepts a code typed with spaces', async () => {
    const { deps } = setup()
    await requestCode('admin@example.com', '1.1.1.1', deps)
    expect((await verifyCode('admin@example.com', ' 100 000 ', deps)).ok).toBe(true)
  })
})

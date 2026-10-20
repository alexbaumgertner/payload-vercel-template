import { NextResponse } from 'next/server'

import { siteConfig } from '@/config/site'
import { runBackup } from '@/lib/backup/run'
import { cronAuthorized } from '@/lib/cron-auth'
import { env } from '@/lib/env'
import { sendMail } from '@/lib/mail-gate'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'
// Dump, encrypt and mail in one invocation; small databases take seconds.
export const maxDuration = 300

const NO_STORE = { 'Cache-Control': 'no-store' }

/** Daily backup (Vercel Cron, `vercel.json`). See src/lib/backup/run.ts and docs/runbooks/backup-restore.md. */
export async function GET(request: Request) {
  if (!cronAuthorized(request, process.env)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const outcome = await runBackup(
    {
      connect: async () => (await getPayloadClient()).db.pool.connect(),
      send: async (message) => sendMail(await getPayloadClient(), 'operator', message),
      siteName: siteConfig.name,
    },
    { ...process.env, DATABASE_URL: env.DATABASE_URL },
  )

  // Row counts and sizes stay in the email; the response only says what happened.
  return NextResponse.json(
    { ok: outcome.status !== 'failed', status: outcome.status },
    { status: outcome.status === 'failed' ? 500 : 200, headers: NO_STORE },
  )
}

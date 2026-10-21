import { NextResponse } from 'next/server'

import { buildHealth, commitLabel, withTimeout } from '@/lib/health'
import { captureServerError } from '@/lib/monitoring/server'
import { getPayloadClient } from '@/lib/payload'

// A plain Next route: the static `api/health` segment wins over Payload's `api/[...slug]`
// catch-all, and `src/proxy.ts` skips `/api`, so no locale redirect.
export const dynamic = 'force-dynamic'

const DB_TIMEOUT_MS = 5_000

/**
 * Uptime checks and Playwright's `webServer.url` poll this. 200 when Payload can reach the
 * database, 503 otherwise; never cached. The first call also initialises Payload (and, in local
 * dev, pushes the schema), so a 200 means the app is ready for tests.
 */
export async function GET() {
  let dbUp = false
  try {
    // A COUNT query returns no documents; overrideAccess because the visitor is anonymous and only
    // the round-trip matters, never the number.
    await withTimeout(
      getPayloadClient().then((payload) =>
        payload.count({ collection: 'users', overrideAccess: true }),
      ),
      DB_TIMEOUT_MS,
    )
    dbUp = true
  } catch (error) {
    await captureServerError(error, 'health')
    console.error('[health] database check failed', error instanceof Error ? error.message : error)
  }

  const { status, body } = buildHealth({
    dbUp,
    commit: commitLabel(process.env),
    now: new Date(),
  })
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

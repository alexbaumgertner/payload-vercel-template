/**
 * Body and status of `GET /api/health`: liveness plus a database round-trip, nothing else.
 * No row counts, hosts or versions beyond the short commit — the endpoint is public.
 */
export type HealthBody = {
  ok: boolean
  db: 'up' | 'down'
  commit: string
  checkedAt: string
}

export function commitLabel(env: Record<string, string | undefined>): string {
  return env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 7) || 'local'
}

export function buildHealth({ dbUp, commit, now }: { dbUp: boolean; commit: string; now: Date }): {
  status: 200 | 503
  body: HealthBody
} {
  return {
    status: dbUp ? 200 : 503,
    body: { ok: dbUp, db: dbUp ? 'up' : 'down', commit, checkedAt: now.toISOString() },
  }
}

/** Rejects after `ms`, so a hanging database answers 503 instead of timing out the function. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

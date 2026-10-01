import 'server-only'

import { monitoringConfig } from './options'

/**
 * Server-side reporting helpers. Without `SENTRY_DSN` they never load the Sentry SDK.
 */

function sentry() {
  return monitoringConfig() ? import('@sentry/nextjs') : null
}

/** Report an error that was caught and turned into a friendly response. */
export async function captureServerError(error: unknown, area: string): Promise<void> {
  const Sentry = await sentry()
  Sentry?.captureException(error, { tags: { area } })
}

/**
 * Wraps a Server Action so uncaught errors reach Sentry. Form data and the returned state are
 * never attached: both can contain emails or login codes.
 */
export async function monitorAction<T>(name: string, action: () => Promise<T>): Promise<T> {
  const Sentry = await sentry()
  if (!Sentry) return action()
  return Sentry.withServerActionInstrumentation(name, { recordResponse: false }, action)
}

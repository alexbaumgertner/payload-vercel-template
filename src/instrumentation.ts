import type { Instrumentation } from 'next'

import { monitoringConfig, sentryOptions } from '@/lib/monitoring/options'

export async function register() {
  const config = monitoringConfig()
  if (!config) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.init(sentryOptions(config))
}

// Errors from Server Components, Route Handlers and Server Actions that nobody caught.
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!monitoringConfig()) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureRequestError(...args)
}

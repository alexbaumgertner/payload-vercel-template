import { clientDsn } from '@/lib/monitoring/client'
import { sentryOptions } from '@/lib/monitoring/options'

if (clientDsn) {
  void import('@sentry/nextjs').then((Sentry) =>
    Sentry.init(
      sentryOptions({
        dsn: clientDsn,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || undefined,
      }),
    ),
  )
}

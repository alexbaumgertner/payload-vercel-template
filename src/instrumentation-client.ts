import { z } from 'zod'

import { clientDsn } from '@/lib/monitoring/client'
import { sentryOptions } from '@/lib/monitoring/options'

// Zod probes for eval support with `Function('')`, which a CSP without 'unsafe-eval' reports
// (or blocks once enforced). Its interpreted parser is plenty fast for form validation.
z.config({ jitless: true })

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

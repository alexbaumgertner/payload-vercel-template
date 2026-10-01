/** Inlined at build time from `SENTRY_DSN` (see `next.config.ts`); empty means monitoring is off. */
export const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? ''

export function reportClientError(error: unknown): void {
  if (!clientDsn) return
  void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error))
}

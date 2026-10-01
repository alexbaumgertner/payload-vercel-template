'use client'

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next'

type PrivacyNavigator = Navigator & { globalPrivacyControl?: boolean }

export function visitorOptedOut(nav: PrivacyNavigator): boolean {
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true
}

export function privacyFilter(event: BeforeSendEvent): BeforeSendEvent | null {
  if (visitorOptedOut(navigator)) return null
  const url = new URL(event.url)
  url.search = ''
  url.hash = ''
  return { ...event, url: url.toString() }
}

/** Vercel Web Analytics page views. Rendered only when `ANALYTICS_PROVIDER=vercel`. */
export function PageViews() {
  return <Analytics beforeSend={privacyFilter} />
}

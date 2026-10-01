import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs'

/**
 * Shared Sentry options for every runtime. Framework-free and pure so it can be unit-tested.
 * Privacy is enforced twice: `dataCollection` stops the SDK from collecting user data, request
 * bodies, cookies and query strings, and `beforeSend` scrubs anything that slips through
 * (emails inside error messages, console breadcrumbs).
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const SAFE_HEADERS = new Set(['user-agent', 'referer', 'accept-language', 'content-type'])

export type MonitoringConfig = {
  dsn: string
  environment?: string
  release?: string
}

/** `null` when `SENTRY_DSN` is unset: monitoring is then a complete no-op. */
export function monitoringConfig(
  source: Record<string, string | undefined> = process.env,
): MonitoringConfig | null {
  const dsn = source.SENTRY_DSN?.trim()
  if (!dsn) return null
  return {
    dsn,
    environment: source.SENTRY_ENVIRONMENT || source.VERCEL_ENV || source.NODE_ENV,
    release: source.SENTRY_RELEASE || source.VERCEL_GIT_COMMIT_SHA,
  }
}

export function redactEmails(value: string): string {
  return value.replace(EMAIL, '[email]')
}

function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redactEmails(value) as T
  if (Array.isArray(value)) return value.map(redactDeep) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactDeep(entry)]),
    ) as T
  }
  return value
}

function stripQuery(url: string): string {
  const index = url.search(/[?#]/)
  return index === -1 ? url : url.slice(0, index)
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // The dev email adapter prints login codes to the console; never ship console output.
  if (breadcrumb.category === 'console') return null
  const scrubbed = redactDeep(breadcrumb)
  if (typeof scrubbed.data?.url === 'string') {
    scrubbed.data = { ...scrubbed.data, url: stripQuery(scrubbed.data.url) }
  }
  return scrubbed
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = { ...event }

  if (scrubbed.request) {
    const { headers, url } = scrubbed.request
    scrubbed.request = {
      method: scrubbed.request.method,
      url: url ? stripQuery(url) : undefined,
      headers: headers
        ? Object.fromEntries(
            Object.entries(headers).filter(([name]) => SAFE_HEADERS.has(name.toLowerCase())),
          )
        : undefined,
    }
  }

  if (scrubbed.user) scrubbed.user = scrubbed.user.id ? { id: scrubbed.user.id } : undefined

  if (scrubbed.breadcrumbs) {
    scrubbed.breadcrumbs = scrubbed.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((crumb): crumb is Breadcrumb => crumb !== null)
  }

  return redactDeep(scrubbed)
}

export function sentryOptions({ dsn, environment, release }: MonitoringConfig) {
  return {
    dsn,
    environment,
    release,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: [...SAFE_HEADERS] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: true, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSendLog: () => null,
  }
}

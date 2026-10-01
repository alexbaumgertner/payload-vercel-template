import 'server-only'

import { z } from 'zod'

/**
 * Provider-agnostic product analytics for server code (Server Actions).
 *
 * - Every event and its props are declared in `analyticsEvents`; props are validated at runtime
 *   and anything that looks like personal data is refused, so a typo can't leak an email.
 * - Off by default (`ANALYTICS_PROVIDER=none`). Nothing is sent, and request headers are never
 *   read, unless a provider is configured AND the visitor sends no Do Not Track / Global
 *   Privacy Control signal.
 * - `track()` never throws: analytics must not break the feature it measures.
 */

const slug = z
  .string()
  .max(64)
  .regex(/^[a-z0-9-]+$/)

export const analyticsEvents = {
  waitlist_joined: z.strictObject({ source: slug }),
  login_code_requested: z.strictObject({ resend: z.boolean() }),
  login_succeeded: z.strictObject({}),
} satisfies Record<string, z.ZodType<Record<string, string | number | boolean>>>

export type AnalyticsEvent = keyof typeof analyticsEvents
export type AnalyticsProps<E extends AnalyticsEvent> = z.infer<(typeof analyticsEvents)[E]>

export const analyticsProviders = ['none', 'vercel'] as const
export type AnalyticsProvider = (typeof analyticsProviders)[number]

type Props = Record<string, string | number | boolean>
type Adapter = (event: AnalyticsEvent, props: Props, headers: Headers) => Promise<void>

const adapters: Record<Exclude<AnalyticsProvider, 'none'>, Adapter> = {
  async vercel(event, props, headers) {
    const { track } = await import('@vercel/analytics/server')
    await track(event, props, { headers: minimalHeaders(headers) })
  },
}

export function analyticsProvider(
  source: Record<string, string | undefined> = process.env,
): AnalyticsProvider {
  const value = source.ANALYTICS_PROVIDER
  return analyticsProviders.find((provider) => provider === value) ?? 'none'
}

/** Do Not Track (`DNT: 1`) or Global Privacy Control (`Sec-GPC: 1`). */
export function optedOut(headers: Headers): boolean {
  return headers.get('dnt') === '1' || headers.get('sec-gpc') === '1'
}

/** Only what the provider needs to count unique visitors; the referer loses its query string. */
function minimalHeaders(headers: Headers): Record<string, string> {
  const kept: Record<string, string> = {}
  for (const name of ['user-agent', 'x-forwarded-for', 'x-real-ip']) {
    const value = headers.get(name)
    if (value) kept[name] = value
  }
  const referer = headers.get('referer')
  if (referer) kept.referer = referer.split(/[?#]/)[0] ?? ''
  return kept
}

const looksPersonal = (value: unknown) => typeof value === 'string' && value.includes('@')

/**
 * @param requestHeaders called only when a provider is enabled, so the no-op path never touches
 * request APIs (and works outside a request, e.g. in tests and scripts).
 */
export async function track<E extends AnalyticsEvent>(
  event: E,
  props: AnalyticsProps<E>,
  requestHeaders: () => Promise<Headers>,
): Promise<void> {
  const provider = analyticsProvider()
  if (provider === 'none') return

  const parsed = analyticsEvents[event].safeParse(props)
  if (!parsed.success || Object.values(parsed.data).some(looksPersonal)) {
    console.warn(`[analytics] dropped "${event}": props don't match the catalog`)
    return
  }

  try {
    const headers = await requestHeaders()
    if (optedOut(headers)) return
    await adapters[provider](event, parsed.data, headers)
  } catch (error) {
    console.warn(`[analytics] "${event}" was not sent`, error)
  }
}

import { afterEach, describe, expect, it, vi } from 'vitest'

import { privacyFilter, visitorOptedOut } from '@/components/PageViews/PageViews'

vi.mock('@vercel/analytics/next', () => ({ Analytics: () => null }))

const setPrivacy = ({ dnt, gpc }: { dnt?: string; gpc?: boolean }) => {
  Object.defineProperty(navigator, 'doNotTrack', { value: dnt ?? null, configurable: true })
  Object.defineProperty(navigator, 'globalPrivacyControl', { value: gpc, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'doNotTrack')
  Reflect.deleteProperty(navigator, 'globalPrivacyControl')
})

describe('page view privacy filter', () => {
  it('drops page views from visitors with Do Not Track', () => {
    setPrivacy({ dnt: '1' })
    expect(privacyFilter({ type: 'pageview', url: 'https://app.example/' })).toBeNull()
  })

  it('drops page views from visitors with Global Privacy Control', () => {
    setPrivacy({ gpc: true })
    expect(privacyFilter({ type: 'pageview', url: 'https://app.example/' })).toBeNull()
  })

  it('removes query strings and fragments, which can carry emails or tokens', () => {
    setPrivacy({})
    expect(
      privacyFilter({
        type: 'pageview',
        url: 'https://app.example/changelog?email=jane@example.com&utm_source=x#v2',
      }),
    ).toEqual({ type: 'pageview', url: 'https://app.example/changelog' })
  })

  it('treats DNT=0 as consent to count', () => {
    setPrivacy({ dnt: '0', gpc: false })
    expect(visitorOptedOut(navigator)).toBe(false)
  })
})

import type { Metadata } from 'next'

import { routing, type Locale } from './routing'

/** Public path of `pathname` in `locale` (the default locale has no prefix). */
export function localizedPath(pathname: string, locale: Locale): string {
  const path = pathname === '/' ? '' : pathname
  if (locale === routing.defaultLocale) return path || '/'
  return `/${locale}${path}`
}

/** Canonical URL plus hreflang links for every locale and `x-default`. */
export function alternatesFor(pathname: string, locale: Locale): Metadata['alternates'] {
  return {
    canonical: localizedPath(pathname, locale),
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, localizedPath(pathname, l)])),
      'x-default': localizedPath(pathname, routing.defaultLocale),
    },
  }
}

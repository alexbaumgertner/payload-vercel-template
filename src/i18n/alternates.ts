import type { Metadata } from 'next'

import { routing, type Locale } from './routing'

/** Public path of `pathname` in `locale` (the default locale has no prefix). */
export function localizedPath(pathname: string, locale: Locale): string {
  const path = pathname === '/' ? '' : pathname
  if (locale === routing.defaultLocale) return path || '/'
  return `/${locale}${path}`
}

/** hreflang targets of `pathname`: every locale plus `x-default` (the default locale). */
export function languageAlternates(pathname: string): Record<Locale | 'x-default', string> {
  return {
    ...(Object.fromEntries(routing.locales.map((l) => [l, localizedPath(pathname, l)])) as Record<
      Locale,
      string
    >),
    'x-default': localizedPath(pathname, routing.defaultLocale),
  }
}

/** Canonical URL plus hreflang links for every locale and `x-default`. */
export function alternatesFor(pathname: string, locale: Locale): Metadata['alternates'] {
  return {
    canonical: localizedPath(pathname, locale),
    languages: languageAlternates(pathname),
  }
}

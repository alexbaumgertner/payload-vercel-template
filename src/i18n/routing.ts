import { defineRouting } from 'next-intl/routing'

import { defaultLocale, locales } from './locales'

export const routing = defineRouting({
  locales,
  defaultLocale,
  // The default locale keeps today's URLs (`/`, `/changelog`); others get a prefix (`/ru`).
  localePrefix: 'as-needed',
})

export type Locale = (typeof routing.locales)[number]

import createMiddleware from 'next-intl/middleware'

import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  // Public site only: the Payload admin and API, the Sentry tunnel, Next/Vercel internals and
  // files (anything with a dot) are never localized.
  matcher: '/((?!(?:admin|api|monitoring)(?:/|$)|_next|_vercel|.*\\..*).*)',
}

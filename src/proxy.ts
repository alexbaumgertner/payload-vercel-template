import createMiddleware from 'next-intl/middleware'

import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  // Public site only: the Payload admin and API, the Sentry tunnel, Next/Vercel internals,
  // files (anything with a dot) and share images are never localized. Next links the default
  // locale's image as `/en/opengraph-image-…`; the proxy would 307 it to an unprefixed URL.
  matcher: '/((?!(?:admin|api|monitoring)(?:/|$)|_next|_vercel|.*\\..*|[^/]+/opengraph-image).*)',
}

import type { AuthStrategy } from 'payload'

import { readSessionCookie, readToken } from './session'

/**
 * Payload auth strategy for the email-code session cookie. Replaces the local
 * (password) strategy, which is disabled on the users collection.
 */
export const emailCodeStrategy: AuthStrategy = {
  name: 'email-code',
  authenticate: async ({ headers, payload }) => {
    const userId = readToken(readSessionCookie(headers.get('cookie')), payload.secret)
    if (!userId) return { user: null }
    try {
      const user = await payload.findByID({
        collection: 'users',
        id: userId,
        depth: 0,
        overrideAccess: true,
      })
      return { user: { ...user, collection: 'users', _strategy: 'email-code' } }
    } catch {
      // The user was deleted while the cookie is still around: treat as signed out.
      return { user: null }
    }
  },
}

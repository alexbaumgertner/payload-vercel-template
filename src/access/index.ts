import type { Access } from 'payload'

export const anyone: Access = () => true

export const authenticated: Access = ({ req }) => Boolean(req.user)

export const publishedOrAuthenticated: Access = ({ req }) => {
  if (req.user) return true
  return { publishedAt: { less_than_equal: new Date().toISOString() } }
}

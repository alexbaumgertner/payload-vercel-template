import type { CollectionConfig } from 'payload'

/**
 * One-time login codes (HMAC-hashed). Also the database-backed rate-limit counter,
 * so rows exist for unknown addresses too. Only the Local API touches it.
 */
export const AuthCodes: CollectionConfig = {
  slug: 'auth-codes',
  admin: { hidden: true },
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'email', type: 'text', required: true, index: true },
    { name: 'codeHash', type: 'text', required: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'attempts', type: 'number', defaultValue: 0 },
    { name: 'requestIp', type: 'text', index: true },
    { name: 'delivered', type: 'checkbox', defaultValue: false },
    { name: 'consumedAt', type: 'date' },
  ],
}

import type { CollectionConfig } from 'payload'

import { authenticated } from '@/access'
import { emailCodeStrategy } from '@/features/auth/strategy'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: {
    // No passwords: users sign in with a one-time code sent by email (features/auth).
    // enableFields keeps the email field (and the existing columns) in the schema.
    disableLocalStrategy: { enableFields: true, optionalPassword: true },
    strategies: [emailCodeStrategy],
  },
  // There is no "create first user" screen without passwords: use `pnpm create-admin <email>`.
  access: {
    create: authenticated,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [],
}

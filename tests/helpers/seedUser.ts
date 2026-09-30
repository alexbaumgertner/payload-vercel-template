import { getPayload } from 'payload'

import config from '../../src/payload.config'

export const testUser = (suffix: string) => ({
  email: `e2e-admin-${suffix}@example.com`,
  password: 'e2e-password-123',
})

export async function seedTestUser(suffix: string): Promise<void> {
  const payload = await getPayload({ config })
  const user = testUser(suffix)
  await payload.delete({ collection: 'users', where: { email: { equals: user.email } } })
  await payload.create({ collection: 'users', data: user })
}

export async function cleanupTestUser(suffix: string): Promise<void> {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'users',
    where: { email: { equals: testUser(suffix).email } },
  })
}

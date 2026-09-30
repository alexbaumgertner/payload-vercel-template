import { getPayload } from 'payload'

import config from '../../src/payload.config'

export const testUserEmail = (suffix: string) => `e2e-admin-${suffix}@example.com`

export async function seedTestUser(suffix: string): Promise<string> {
  const payload = await getPayload({ config })
  const email = testUserEmail(suffix)
  await payload.delete({ collection: 'users', where: { email: { equals: email } } })
  await payload.create({ collection: 'users', data: { email } })
  return email
}

export async function cleanupTestUser(suffix: string): Promise<void> {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'users',
    where: { email: { equals: testUserEmail(suffix) } },
  })
}

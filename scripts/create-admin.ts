import './load-env'

import { getPayload } from 'payload'

import { emailSchema } from '../src/features/auth/schema'
import { assertLocalDatabaseForScript } from '../src/lib/database-target'
import { env } from '../src/lib/env'
import config from '../src/payload.config'

// Passwordless auth has no "create first user" screen: add users from the CLI.
// Usage: pnpm create-admin you@example.com
// Production (deliberate, by a human): docs/runbooks/production-admin.md
async function main() {
  assertLocalDatabaseForScript('create-admin', { ...process.env, DATABASE_URL: env.DATABASE_URL })
  const parsed = emailSchema.safeParse(process.argv[2] ?? '')
  if (!parsed.success) throw new Error('Usage: pnpm create-admin <email>')
  const email = parsed.data

  const payload = await getPayload({ config })
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: { email: { equals: email } },
  })
  if (totalDocs > 0) {
    payload.logger.info(`${email} already exists — sign in at /admin with a code sent by email.`)
  } else {
    await payload.create({ collection: 'users', data: { email } })
    payload.logger.info(`Created ${email} — sign in at /admin with a code sent by email.`)
  }
}

// Payload keeps background handles (DB pool, jobs) open, so exit explicitly.
main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error)
    process.exit(1)
  },
)

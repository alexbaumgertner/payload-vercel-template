import 'dotenv/config'

import { getPayload } from 'payload'

import { emailSchema } from '../src/features/auth/schema'
import config from '../src/payload.config'

// Passwordless auth has no "create first user" screen: add users from the CLI.
// Usage: pnpm create-admin you@example.com
async function main() {
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

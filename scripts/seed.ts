import './load-env'

import { getPayload } from 'payload'

import { canSeed } from '../src/lib/database-target'
import { env } from '../src/lib/env'
import config from '../src/payload.config'
import { seedDemoChangelog } from './seed-demo'

async function seed() {
  if (!canSeed({ ...process.env, DATABASE_URL: env.DATABASE_URL })) {
    throw new Error(
      'pnpm seed writes demo data and runs only against a local database or on a Vercel Preview ' +
        'build. Point DATABASE_URL at a local Postgres (.env.development.local).',
    )
  }
  const payload = await getPayload({ config })

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
  const { totalDocs: userCount } = await payload.count({
    collection: 'users',
    where: { email: { equals: email } },
  })
  if (userCount === 0) {
    await payload.create({ collection: 'users', data: { email } })
    payload.logger.info(`Created admin ${email} (sign in with an email code)`)
  }

  await seedDemoChangelog(payload)

  payload.logger.info('Seed complete')
  await payload.destroy()
}

// Payload keeps background handles (DB pool, jobs) open, so exit explicitly.
seed().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error)
    process.exit(1)
  },
)

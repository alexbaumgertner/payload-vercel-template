import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../src/payload.config'

type Paragraph = string

function richText(paragraphs: Paragraph[]) {
  return {
    root: {
      type: 'root',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        format: '' as const,
        indent: 0,
        version: 1,
        direction: 'ltr' as const,
        textFormat: 0,
        children: [
          { type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
        ],
      })),
    },
  }
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

const entries = [
  {
    title: 'Waitlist with spam protection',
    tag: 'feature',
    summary:
      'Collect early-access emails straight into Postgres, with a honeypot and Zod validation.',
    body: richText([
      'The landing page form posts to a Server Action, validates input with Zod and stores signups in the Payload "Waitlist" collection.',
      'Signups are private: the public REST and GraphQL APIs cannot read them, only admins can.',
    ]),
    publishedAt: daysAgo(1),
  },
  {
    title: 'Changelog managed from the admin panel',
    tag: 'feature',
    summary:
      'Write release notes in Payload, schedule them with a publish date, and they appear here automatically.',
    body: richText([
      'Entries dated in the future stay hidden until their publish date. Saving an entry revalidates the landing page and this page.',
    ]),
    publishedAt: daysAgo(4),
  },
  {
    title: 'Faster cold starts on Vercel',
    tag: 'improvement',
    summary: 'Migrations now run during the build instead of on the first request.',
    publishedAt: daysAgo(9),
  },
  {
    title: 'Correct dates across time zones',
    tag: 'fix',
    summary: 'Release dates are formatted in UTC, so every visitor sees the same day.',
    publishedAt: daysAgo(15),
  },
] as const

async function seed() {
  const payload = await getPayload({ config })
  const context = { disableRevalidate: true }

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'change-me-please'
  const { totalDocs: userCount } = await payload.count({
    collection: 'users',
    where: { email: { equals: email } },
  })
  if (userCount === 0) {
    await payload.create({ collection: 'users', data: { email, password } })
    payload.logger.info(`Created admin ${email} / ${password}`)
  }

  for (const entry of entries) {
    const { totalDocs } = await payload.count({
      collection: 'changelog',
      where: { title: { equals: entry.title } },
    })
    if (totalDocs === 0) {
      await payload.create({ collection: 'changelog', data: { ...entry }, context })
    }
  }

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

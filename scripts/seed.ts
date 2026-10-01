import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../src/payload.config'
import type { Changelog } from '../src/payload-types'

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

type Translation = Pick<Changelog, 'title' | 'summary' | 'body'>
type SeedEntry = Translation & Pick<Changelog, 'tag' | 'publishedAt'> & { ru?: Translation }

const entries: SeedEntry[] = [
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
    ru: {
      title: 'Лист ожидания с защитой от спама',
      summary:
        'Собирайте email-адреса для раннего доступа прямо в Postgres — с honeypot и валидацией Zod.',
      body: richText([
        'Форма на лендинге отправляется в Server Action, проверяет данные через Zod и сохраняет заявки в коллекцию Payload «Waitlist».',
        'Заявки приватны: публичные REST и GraphQL API их не отдают, видят только админы.',
      ]),
    },
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
    ru: {
      title: 'Список изменений из админки',
      summary:
        'Пишите заметки о релизах в Payload, планируйте дату публикации — и они сами появятся здесь.',
      body: richText([
        'Записи с датой в будущем скрыты до дня публикации. Сохранение записи обновляет лендинг и эту страницу.',
      ]),
    },
  },
  {
    title: 'Faster cold starts on Vercel',
    tag: 'improvement',
    summary: 'Migrations now run during the build instead of on the first request.',
    publishedAt: daysAgo(9),
    ru: {
      title: 'Быстрый холодный старт на Vercel',
      summary: 'Миграции теперь выполняются во время сборки, а не при первом запросе.',
    },
  },
  {
    title: 'Correct dates across time zones',
    tag: 'fix',
    summary: 'Release dates are formatted in UTC, so every visitor sees the same day.',
    publishedAt: daysAgo(15),
    // No Russian translation on purpose: the public site falls back to English.
  },
]

async function seed() {
  const payload = await getPayload({ config })
  const context = { disableRevalidate: true }

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
  const { totalDocs: userCount } = await payload.count({
    collection: 'users',
    where: { email: { equals: email } },
  })
  if (userCount === 0) {
    await payload.create({ collection: 'users', data: { email } })
    payload.logger.info(`Created admin ${email} (sign in with an email code)`)
  }

  for (const { ru, ...entry } of entries) {
    const { totalDocs } = await payload.count({
      collection: 'changelog',
      locale: 'en',
      where: { title: { equals: entry.title } },
    })
    if (totalDocs > 0) continue
    const created = await payload.create({
      collection: 'changelog',
      locale: 'en',
      data: { ...entry },
      context,
    })
    if (ru) {
      await payload.update({
        collection: 'changelog',
        id: created.id,
        locale: 'ru',
        data: ru,
        context,
      })
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

import { getPayload } from 'payload'

import config from '../../src/payload.config'

const context = { disableRevalidate: true }

type Translation = { title: string; summary: string }

/** Creates a published entry with English (and optionally Russian) content; returns a cleanup. */
export async function seedChangelogEntry(en: Translation, ru?: Translation) {
  const payload = await getPayload({ config })
  const entry = await payload.create({
    collection: 'changelog',
    locale: 'en',
    context,
    data: { ...en, tag: 'feature', publishedAt: new Date(Date.now() - 60_000).toISOString() },
  })
  if (ru) {
    await payload.update({ collection: 'changelog', id: entry.id, locale: 'ru', context, data: ru })
  }
  return () => payload.delete({ collection: 'changelog', id: entry.id, context })
}

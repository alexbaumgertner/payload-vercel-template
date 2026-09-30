import { revalidatePath } from 'next/cache'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  PayloadRequest,
} from 'payload'

import { authenticated, publishedOrAuthenticated } from '@/access'

export const CHANGELOG_TAGS = ['feature', 'improvement', 'fix'] as const

// Scripts and tests run outside a Next.js request, where revalidatePath throws.
function revalidateChangelogPages(req: PayloadRequest) {
  if (req.context.disableRevalidate) return
  revalidatePath('/changelog')
  revalidatePath('/')
}

const afterChange: CollectionAfterChangeHook = ({ doc, req }) => {
  revalidateChangelogPages(req)
  return doc
}

const afterDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  revalidateChangelogPages(req)
  return doc
}

export const ChangelogEntries: CollectionConfig = {
  slug: 'changelog',
  labels: { singular: 'Changelog entry', plural: 'Changelog' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'tag', 'publishedAt'],
  },
  defaultSort: '-publishedAt',
  access: {
    read: publishedOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    afterChange: [afterChange],
    afterDelete: [afterDelete],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'tag',
      type: 'select',
      required: true,
      defaultValue: 'feature',
      options: CHANGELOG_TAGS.map((value) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1),
      })),
    },
    { name: 'summary', type: 'textarea', required: true, maxLength: 280 },
    { name: 'body', type: 'richText' },
    {
      name: 'publishedAt',
      type: 'date',
      required: true,
      index: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        position: 'sidebar',
        description: 'Entries dated in the future stay hidden until then.',
      },
    },
  ],
}

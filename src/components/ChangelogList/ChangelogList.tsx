import { RichText } from '@payloadcms/richtext-lexical/react'

import { formatDate } from '@/lib/format'
import type { Changelog } from '@/payload-types'

import styles from './ChangelogList.module.css'

type ChangelogListProps = {
  entries: Changelog[]
  showBody?: boolean
}

export function ChangelogList({ entries, showBody = false }: ChangelogListProps) {
  if (entries.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No releases yet</p>
        <p>
          Publish your first entry from the <a href="/admin/collections/changelog">admin panel</a>{' '}
          or run <code>pnpm seed</code>.
        </p>
      </div>
    )
  }

  return (
    <ol className={styles.list}>
      {entries.map((entry) => (
        <li key={entry.id} className={styles.item}>
          <div className={styles.meta}>
            <time dateTime={entry.publishedAt}>{formatDate(entry.publishedAt)}</time>
            <span className={styles.tag} data-tag={entry.tag}>
              {entry.tag}
            </span>
          </div>
          <article className={styles.content}>
            <h3 className={styles.title}>{entry.title}</h3>
            <p className={styles.summary}>{entry.summary}</p>
            {showBody && entry.body ? <RichText data={entry.body} className={styles.body} /> : null}
          </article>
        </li>
      ))}
    </ol>
  )
}

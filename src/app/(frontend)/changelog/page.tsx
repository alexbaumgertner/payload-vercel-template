import type { Metadata } from 'next'

import { ChangelogList } from '@/components/ChangelogList/ChangelogList'
import { getChangelogEntries } from '@/features/changelog/queries'

import styles from './page.module.css'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'New features, improvements and fixes.',
}

export default async function ChangelogPage() {
  const entries = await getChangelogEntries({ limit: 50 })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Changelog</h1>
        <p className={styles.lead}>New features, improvements and fixes — newest first.</p>
      </header>
      <ChangelogList entries={entries} showBody />
    </div>
  )
}

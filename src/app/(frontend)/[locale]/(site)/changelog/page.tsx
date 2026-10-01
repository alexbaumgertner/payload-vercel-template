import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'

import { ChangelogList } from '@/components/ChangelogList/ChangelogList'
import { getChangelogEntries } from '@/features/changelog/queries'
import { alternatesFor } from '@/i18n/alternates'
import { routing } from '@/i18n/routing'

import styles from './page.module.css'

export const revalidate = 3600

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Changelog' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor('/changelog', locale),
  }
}

export default async function ChangelogPage({ params }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return null
  const [t, entries] = await Promise.all([
    getTranslations({ locale, namespace: 'Changelog' }),
    getChangelogEntries({ limit: 50, locale }),
  ])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.lead}>{t('lead')}</p>
      </header>
      <ChangelogList entries={entries} showBody />
    </div>
  )
}

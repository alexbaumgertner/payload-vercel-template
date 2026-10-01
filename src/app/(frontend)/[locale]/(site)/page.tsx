import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'

import { ChangelogList } from '@/components/ChangelogList/ChangelogList'
import { WaitlistForm } from '@/components/WaitlistForm/WaitlistForm'
import { getChangelogEntries } from '@/features/changelog/queries'
import { alternatesFor } from '@/i18n/alternates'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

import styles from './page.module.css'

export const revalidate = 3600

const FEATURES = ['admin', 'postgres', 'types', 'tests', 'ai', 'css'] as const

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  return { alternates: alternatesFor('/', locale) }
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return null
  const [t, tMeta, latest] = await Promise.all([
    getTranslations({ locale, namespace: 'Home' }),
    getTranslations({ locale, namespace: 'Metadata' }),
    getChangelogEntries({ limit: 3, locale }),
  ])

  return (
    <>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>{t('eyebrow')}</p>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.lead}>{tMeta('description')}</p>
        <WaitlistForm source="landing-hero" />
        <p className={styles.note}>{t('note')}</p>
      </section>

      <section id="features" className={styles.section} aria-labelledby="features-title">
        <h2 id="features-title" className={styles.sectionTitle}>
          {t('featuresTitle')}
        </h2>
        <ul className={styles.grid}>
          {FEATURES.map((key) => (
            <li key={key} className={styles.card}>
              <h3 className={styles.cardTitle}>{t(`features.${key}.title`)}</h3>
              <p className={styles.cardBody}>{t(`features.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="latest-title">
        <div className={styles.sectionHeader}>
          <h2 id="latest-title" className={styles.sectionTitle}>
            {t('latestTitle')}
          </h2>
          <Link href="/changelog" className={styles.more}>
            {t('fullChangelog')}
          </Link>
        </div>
        <ChangelogList entries={latest} />
      </section>
    </>
  )
}

'use client'

import { useLocale, useTranslations } from 'next-intl'

import { Link, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

import styles from './LocaleSwitcher.module.css'

export function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher')
  const current = useLocale()
  const pathname = usePathname()

  if (routing.locales.length < 2) return null

  return (
    <div role="group" aria-label={t('label')} className={styles.switcher}>
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          hrefLang={locale}
          lang={locale}
          aria-label={t(locale)}
          aria-current={locale === current ? 'true' : undefined}
          className={styles.option}
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </div>
  )
}

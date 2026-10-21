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
          aria-current={locale === current ? 'true' : undefined}
          className={styles.option}
        >
          {/* The accessible name starts with the visible code (WCAG 2.5.3 "label in name"),
              so "click EN" works for voice control and screen readers still hear the language. */}
          {locale.toUpperCase()}
          <span className="visually-hidden"> {t(locale)}</span>
        </Link>
      ))}
    </div>
  )
}

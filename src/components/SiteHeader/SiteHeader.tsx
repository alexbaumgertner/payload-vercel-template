import { useTranslations } from 'next-intl'

import { LocaleSwitcher } from '@/components/LocaleSwitcher/LocaleSwitcher'
import { siteConfig } from '@/config/site'
import { Link } from '@/i18n/navigation'

import styles from './SiteHeader.module.css'

export function SiteHeader() {
  const t = useTranslations('Header')

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label={t('home')}>
          <span className={styles.logo} aria-hidden="true" />
          <span className={styles.brandName}>{siteConfig.name}</span>
        </Link>
        <nav aria-label={t('nav')} className={styles.navArea}>
          <ul className={styles.nav}>
            <li>
              <Link href="/#features" className={styles.link}>
                {t('features')}
              </Link>
            </li>
            <li>
              <Link href="/changelog" className={styles.link}>
                {t('changelog')}
              </Link>
            </li>
            <li>
              {/* The admin is not localized: a plain link keeps it out of locale routing. */}
              <a href="/admin" className={styles.link}>
                {t('admin')}
              </a>
            </li>
          </ul>
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  )
}

import { useTranslations } from 'next-intl'

import { siteConfig } from '@/config/site'

import styles from './SiteFooter.module.css'

export function SiteFooter() {
  const t = useTranslations('Footer')

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p>
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
        <p className={styles.muted}>{t('stack')}</p>
      </div>
    </footer>
  )
}

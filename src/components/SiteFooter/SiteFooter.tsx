import { siteConfig } from '@/config/site'

import styles from './SiteFooter.module.css'

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p>
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
        <p className={styles.muted}>Next.js 16 · Payload 3 · Postgres · Vercel</p>
      </div>
    </footer>
  )
}

import Link from 'next/link'

import { siteConfig } from '@/config/site'

import styles from './SiteHeader.module.css'

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logo} aria-hidden="true" />
          {siteConfig.name}
        </Link>
        <nav aria-label="Main">
          <ul className={styles.nav}>
            {siteConfig.nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={styles.link}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}

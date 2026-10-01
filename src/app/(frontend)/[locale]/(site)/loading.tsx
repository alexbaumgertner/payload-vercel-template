import { useTranslations } from 'next-intl'

import styles from '../status.module.css'

export default function Loading() {
  const t = useTranslations('Status')

  return (
    <div className={`${styles.status} ${styles.pending}`} aria-busy="true" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.body}>{t('loading')}</p>
    </div>
  )
}

import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

import styles from './status.module.css'

export default function NotFound() {
  const t = useTranslations('Status')

  return (
    <div className={styles.status}>
      <h1 className={styles.title}>{t('notFoundTitle')}</h1>
      <p className={styles.body}>{t('notFoundBody')}</p>
      <Link href="/" className={styles.action}>
        {t('backHome')}
      </Link>
    </div>
  )
}

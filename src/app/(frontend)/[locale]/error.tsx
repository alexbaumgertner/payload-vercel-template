'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

import { reportClientError } from '@/lib/monitoring/client'

import styles from './status.module.css'

export default function FrontendError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('Status')

  useEffect(() => {
    reportClientError(error)
  }, [error])

  return (
    <div className={styles.status}>
      <h1 className={styles.title}>{t('errorTitle')}</h1>
      <p className={styles.body}>{t('errorBody')}</p>
      <button type="button" className={styles.action} onClick={reset}>
        {t('retry')}
      </button>
    </div>
  )
}

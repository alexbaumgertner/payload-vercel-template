'use client'

import { useEffect } from 'react'

import { reportClientError } from '@/lib/monitoring/client'

import styles from './global-error.module.css'

// Replaces a root layout that crashed, so it renders its own <html> and can't rely on globals.css.
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    reportClientError(error)
  }, [error])

  return (
    <html lang="en">
      <body className={styles.page}>
        <h1 className={styles.title}>Something broke on our side</h1>
        <p>The page failed to load. Try again in a moment.</p>
        <button type="button" className={styles.action} onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  )
}

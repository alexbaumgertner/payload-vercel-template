'use client'

import styles from './status.module.css'

export default function FrontendError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.status}>
      <h1 className={styles.title}>Something broke on our side</h1>
      <p className={styles.body}>
        The page failed to load. It&apos;s been logged — try again in a moment.
      </p>
      <button type="button" className={styles.action} onClick={reset}>
        Try again
      </button>
    </div>
  )
}

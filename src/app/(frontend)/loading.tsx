import styles from './status.module.css'

export default function Loading() {
  return (
    <div className={styles.status} aria-busy="true" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.body}>Loading…</p>
    </div>
  )
}

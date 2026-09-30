import Link from 'next/link'

import styles from './status.module.css'

export default function NotFound() {
  return (
    <div className={styles.status}>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.body}>
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link href="/" className={styles.action}>
        Back to home
      </Link>
    </div>
  )
}

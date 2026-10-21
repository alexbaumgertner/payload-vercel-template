'use client'

import { useTransition } from 'react'

import { logoutAction } from '@/features/auth/actions'

import styles from './LogoutButton.module.css'

/** Clears the email-code session cookie; Payload's own logout only knows its JWT cookie. */
export function LogoutButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      className={styles.button}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await logoutAction()
          // Full reload (not router.push) so Payload drops its client-side auth state.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- see above
          window.location.assign('/admin/login')
        })
      }
    >
      {isPending ? 'Logging out…' : 'Log out'}
    </button>
  )
}

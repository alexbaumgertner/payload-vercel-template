'use client'

import { useActionState, useId } from 'react'

import { joinWaitlistAction } from '@/features/waitlist/actions'
import { initialWaitlistState } from '@/features/waitlist/schema'

import styles from './WaitlistForm.module.css'

export function WaitlistForm({ source }: { source: string }) {
  const [state, formAction, isPending] = useActionState(joinWaitlistAction, initialWaitlistState)
  const emailId = useId()
  const errorId = useId()

  if (state.status === 'success') {
    return (
      <p className={styles.success} role="status">
        {state.message}
      </p>
    )
  }

  const emailError =
    state.status === 'error' ? (state.fieldErrors?.email?.[0] ?? state.message) : null

  return (
    <form action={formAction} className={styles.form} noValidate>
      <input type="hidden" name="source" value={source} />
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label htmlFor={emailId} className="visually-hidden">
        Email address
      </label>
      <div className={styles.row}>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          className={styles.input}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? errorId : undefined}
          disabled={isPending}
        />
        <button type="submit" className={styles.button} disabled={isPending}>
          {isPending ? 'Joining…' : 'Join the waitlist'}
        </button>
      </div>

      <p id={errorId} className={styles.error} role="alert" aria-live="polite">
        {emailError}
      </p>
    </form>
  )
}

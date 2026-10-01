'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useId } from 'react'

import { joinWaitlistAction } from '@/features/waitlist/actions'
import { initialWaitlistState } from '@/features/waitlist/schema'

import styles from './WaitlistForm.module.css'

export function WaitlistForm({ source }: { source: string }) {
  const t = useTranslations('Waitlist')
  const [state, formAction, isPending] = useActionState(joinWaitlistAction, initialWaitlistState)
  const emailId = useId()
  const errorId = useId()

  if (state.status === 'success') {
    return (
      <p className={styles.success} role="status">
        {t('success')}
      </p>
    )
  }

  const error = state.status === 'error' ? state.error : null

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
        {t('emailLabel')}
      </label>
      <div className={styles.row}>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder={t('placeholder')}
          className={styles.input}
          aria-invalid={error === 'invalid_email'}
          aria-describedby={error ? errorId : undefined}
          disabled={isPending}
        />
        <button type="submit" className={styles.button} disabled={isPending}>
          {isPending ? t('pending') : t('submit')}
        </button>
      </div>

      <p id={errorId} className={styles.error} role="alert">
        {error ? t(`errors.${error}`) : null}
      </p>
    </form>
  )
}

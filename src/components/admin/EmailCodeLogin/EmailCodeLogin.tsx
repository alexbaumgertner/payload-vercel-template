'use client'

import { useSearchParams } from 'next/navigation'
import { useActionState, useEffect, useId } from 'react'

import { loginAction } from '@/features/auth/actions'
import { CODE_LENGTH, initialLoginState } from '@/features/auth/schema'

import styles from './EmailCodeLogin.module.css'

/**
 * Admin login: email → 6-digit code by email. Rendered in Payload's `beforeLogin`
 * slot; the password form is gone because the local strategy is disabled.
 */
export function EmailCodeLogin() {
  const [state, formAction, isPending] = useActionState(loginAction, initialLoginState)
  const redirect = useSearchParams().get('redirect') ?? ''
  const emailId = useId()
  const codeId = useId()
  const errorId = useId()

  useEffect(() => {
    // Full reload so the admin shell boots with the new session cookie.
    if (state.step === 'done') window.location.assign(state.redirectTo)
  }, [state])

  const error = state.step !== 'done' ? state.error : undefined

  if (state.step === 'done') {
    return (
      <p className={styles.hint} role="status">
        Signed in. Opening the admin panel…
      </p>
    )
  }

  return (
    <form action={formAction} className={styles.form} noValidate>
      <input type="hidden" name="redirect" value={redirect} />

      {state.step === 'email' ? (
        <>
          <div className={styles.field}>
            <label htmlFor={emailId} className={styles.label}>
              Email
            </label>
            <input
              id={emailId}
              name="email"
              type="email"
              defaultValue={state.email}
              autoComplete="email"
              inputMode="email"
              required
              autoFocus
              className={styles.input}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              disabled={isPending}
            />
          </div>
          <button
            type="submit"
            name="intent"
            value="request"
            className="btn btn--style-primary btn--size-large"
            disabled={isPending}
          >
            {isPending ? 'Sending…' : 'Send login code'}
          </button>
        </>
      ) : (
        <>
          <input type="hidden" name="email" value={state.email} />
          <p className={styles.hint}>
            If <strong>{state.email}</strong> has an account, a {CODE_LENGTH}-digit code is on its
            way. It is valid for 10 minutes.
          </p>
          <div className={styles.field}>
            <label htmlFor={codeId} className={styles.label}>
              Code
            </label>
            <input
              key={state.email}
              id={codeId}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={CODE_LENGTH + 1}
              required
              autoFocus
              className={`${styles.input} ${styles.code}`}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              disabled={isPending}
            />
          </div>
          <div className={styles.actions}>
            <button
              type="submit"
              name="intent"
              value="verify"
              className="btn btn--style-primary btn--size-large"
              disabled={isPending}
            >
              {isPending ? 'Checking…' : 'Sign in'}
            </button>
            <button
              type="submit"
              name="intent"
              value="request"
              formNoValidate
              className="btn btn--style-secondary btn--size-large"
              disabled={isPending}
            >
              Send a new code
            </button>
            <button
              type="submit"
              name="intent"
              value="restart"
              formNoValidate
              className={styles.link}
              disabled={isPending}
            >
              Use another email
            </button>
          </div>
        </>
      )}

      <p id={errorId} className={styles.error} role="alert">
        {error}
      </p>
    </form>
  )
}

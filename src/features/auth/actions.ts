'use server'

import { cookies, headers } from 'next/headers'

import { getPayloadClient } from '@/lib/payload'

import { loginCodeSender } from './email'
import { requestCode, verifyCode, type OtpDeps } from './otp'
import type { LoginState } from './schema'
import { issueToken, SESSION_COOKIE, sessionCookieOptions } from './session'
import { payloadOtpStore } from './store'

async function otpDeps(): Promise<OtpDeps> {
  const payload = await getPayloadClient()
  return {
    store: payloadOtpStore(payload),
    sendCode: loginCodeSender(payload),
    secret: payload.secret,
  }
}

async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown'
}

/** Only same-origin paths, so the login form can't be turned into an open redirect. */
function safeRedirect(value: FormDataEntryValue | null): string {
  const target = typeof value === 'string' ? value : ''
  return target.startsWith('/') && !target.startsWith('//') ? target : '/admin'
}

export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = formData.get('intent')

  if (intent === 'restart') return { step: 'email', email: prev.step === 'code' ? prev.email : '' }

  if (intent === 'request') {
    const email = String(formData.get('email') ?? '')
    const result = await requestCode(email, await clientIp(), await otpDeps())
    if (!result.ok) {
      // Resending from the code step keeps the user on that step with the error.
      return prev.step === 'code'
        ? { ...prev, error: result.error }
        : { step: 'email', email, error: result.error }
    }
    return { step: 'code', email: result.email }
  }

  if (intent === 'verify' && prev.step === 'code') {
    const code = String(formData.get('code') ?? '')
    const deps = await otpDeps()
    const result = await verifyCode(prev.email, code, deps)
    if (!result.ok) return { ...prev, error: result.error }

    const { token, maxAge } = issueToken(result.userId, deps.secret)
    ;(await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(maxAge))
    return { step: 'done', redirectTo: safeRedirect(formData.get('redirect')) }
  }

  return prev
}

export async function logoutAction(): Promise<void> {
  ;(await cookies()).set(SESSION_COOKIE, '', sessionCookieOptions(0))
}

'use server'

import { cookies, headers } from 'next/headers'

import { track } from '@/lib/analytics'
import { captureServerError, monitorAction } from '@/lib/monitoring/server'
import { getPayloadClient } from '@/lib/payload'

import { loginCodeSender } from './email'
import { requestCode, verifyCode, type OtpDeps } from './otp'
import { safeRedirect } from './redirect'
import type { LoginState } from './schema'
import { issueToken, SESSION_COOKIE, sessionCookieOptions } from './session'
import { payloadOtpStore } from './store'

async function otpDeps(): Promise<OtpDeps> {
  const payload = await getPayloadClient()
  const send = loginCodeSender(payload)
  return {
    store: payloadOtpStore(payload),
    sendCode: async (to, code) => {
      try {
        await send(to, code)
      } catch (error) {
        await captureServerError(error, 'auth-email')
        throw error
      }
    },
    secret: payload.secret,
  }
}

async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown'
}

export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  return monitorAction('loginAction', () => handleLogin(prev, formData))
}

async function handleLogin(prev: LoginState, formData: FormData): Promise<LoginState> {
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
    await track('login_code_requested', { resend: prev.step === 'code' }, headers)
    return { step: 'code', email: result.email }
  }

  if (intent === 'verify' && prev.step === 'code') {
    const code = String(formData.get('code') ?? '')
    const deps = await otpDeps()
    const result = await verifyCode(prev.email, code, deps)
    if (!result.ok) return { ...prev, error: result.error }

    const { token, maxAge } = issueToken(result.userId, deps.secret)
    ;(await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(maxAge))
    await track('login_succeeded', {}, headers)
    return { step: 'done', redirectTo: safeRedirect(formData.get('redirect')) }
  }

  return prev
}

export async function logoutAction(): Promise<void> {
  return monitorAction('logoutAction', async () => {
    ;(await cookies()).set(SESSION_COOKIE, '', sessionCookieOptions(0))
  })
}

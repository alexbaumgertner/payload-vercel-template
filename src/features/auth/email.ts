import type { Payload } from 'payload'

import { siteConfig } from '@/config/site'
import { env } from '@/lib/env'

export function loginCodeEmail(code: string) {
  const text = [
    `Your ${siteConfig.name} login code: ${code}`,
    '',
    'It is valid for 10 minutes and works once.',
    'If you did not try to sign in, you can ignore this email.',
  ].join('\n')
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#1b1a17;max-width:32rem">',
    `<p style="margin:0 0 1.25rem;font-weight:600">${siteConfig.name}</p>`,
    '<p style="margin:0 0 .75rem">Your login code:</p>',
    `<p style="margin:0 0 1.25rem;font-size:30px;font-weight:600;letter-spacing:.18em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${code}</p>`,
    '<p style="margin:0">It is valid for 10 minutes and works once.</p>',
    '<p style="margin:1.75rem 0 0;font-size:13px;color:#6b675e">If you did not try to sign in, you can ignore this email.</p>',
    '</div>',
  ].join('')
  return { subject: `${code} is your ${siteConfig.name} login code`, text, html }
}

/**
 * Sends through Payload's email adapter (Resend). Without RESEND_API_KEY outside
 * production the code is printed to the server console so local login still works.
 */
export function loginCodeSender(payload: Payload) {
  return async (to: string, code: string) => {
    if (!env.RESEND_API_KEY) {
      if (process.env.NODE_ENV === 'production') throw new Error('RESEND_API_KEY is not set')
      console.info(`\n[auth] RESEND_API_KEY not set — login code for ${to}: ${code}\n`)
      return
    }
    await payload.sendEmail({ to, ...loginCodeEmail(code) })
  }
}

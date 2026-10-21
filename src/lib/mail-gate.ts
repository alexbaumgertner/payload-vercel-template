import type { Payload, SendEmailOptions } from 'payload'

/**
 * One door for outbound mail, so previews and the Resend sandbox never mail real people.
 *
 * Previews usually run with the production Resend key and sender (the variables are shared), on a
 * database branched from production — real addresses. Without a gate, an invite or notification
 * triggered on a preview URL goes out from the production domain. The `@resend.dev` sandbox sender
 * only delivers to the Resend account owner anyway; anything else sent from it bounces or is
 * dropped, so it is refused up front instead of failing silently.
 *
 * Kinds:
 * - `login-code` — always allowed: signing in to a preview must keep working.
 * - `operator` — mail to the project owner (backup reports to `BACKUP_EMAIL`): refused on previews,
 *   allowed from the sandbox sender (which delivers to the account owner).
 * - `general` — everything products add (invites, notifications): refused on previews and from the
 *   sandbox sender.
 *
 * Framework-free: env is a parameter.
 */

type Env = Record<string, string | undefined>

export type MailKind = 'login-code' | 'operator' | 'general'

export type MailRefusal = 'preview_deployment' | 'sandbox_sender' | 'no_email_provider'

/** `Name <a@b>` or `a@b` → its parts. The name is undefined for a bare address. */
export function parseSender(raw: string): { name?: string; address: string } {
  const match = raw.match(/^\s*(.*?)\s*<([^>]*)>\s*$/)
  if (!match) return { address: raw.trim() }
  const name = match[1]?.replace(/^"(.*)"$/, '$1').trim()
  return { name: name || undefined, address: (match[2] ?? '').trim() }
}

const DEFAULT_SENDER = 'onboarding@resend.dev'

export function senderAddress(env: Env): string {
  return parseSender(env.EMAIL_FROM_ADDRESS?.trim() || DEFAULT_SENDER).address
}

export function isSandboxSender(env: Env): boolean {
  return senderAddress(env).toLowerCase().endsWith('@resend.dev')
}

/** Null when the mail may go out, otherwise why not. */
export function mailRefusal(kind: MailKind, env: Env): MailRefusal | null {
  if (kind === 'login-code') return null
  if (env.VERCEL_ENV === 'preview') return 'preview_deployment'
  if (kind === 'general' && isSandboxSender(env)) return 'sandbox_sender'
  return null
}

export type SendMailResult = { sent: true } | { sent: false; reason: MailRefusal }

/**
 * Sends through Payload's email adapter (Resend) after the gate. Without `RESEND_API_KEY` nothing
 * is sent (Payload would only log it) and the caller learns that from the result.
 */
export async function sendMail(
  payload: Pick<Payload, 'sendEmail'>,
  kind: MailKind,
  message: SendEmailOptions,
  env: Env = process.env,
): Promise<SendMailResult> {
  const refusal = mailRefusal(kind, env)
  if (refusal) {
    console.warn(`[mail] ${kind} mail not sent: ${refusal}`)
    return { sent: false, reason: refusal }
  }
  if (!env.RESEND_API_KEY?.trim()) return { sent: false, reason: 'no_email_provider' }
  await payload.sendEmail(message)
  return { sent: true }
}

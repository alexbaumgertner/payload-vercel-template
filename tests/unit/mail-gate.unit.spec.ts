// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { isSandboxSender, mailRefusal, parseSender, sendMail, senderAddress } from '@/lib/mail-gate'

const live = { RESEND_API_KEY: 're_test', EMAIL_FROM_ADDRESS: 'Acme News <news@acme.example>' }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseSender / senderAddress', () => {
  it.each([
    ['Acme News <news@acme.example>', { name: 'Acme News', address: 'news@acme.example' }],
    ['"Acme, Inc." <news@acme.example>', { name: 'Acme, Inc.', address: 'news@acme.example' }],
    ['<news@acme.example>', { name: undefined, address: 'news@acme.example' }],
    [' news@acme.example ', { address: 'news@acme.example' }],
  ])('parses %j', (raw, expected) => {
    expect(parseSender(raw)).toEqual(expected)
  })

  it('falls back to the Resend sandbox sender when unset', () => {
    expect(senderAddress({})).toBe('onboarding@resend.dev')
    expect(senderAddress(live)).toBe('news@acme.example')
  })

  it('detects the sandbox sender in both forms', () => {
    expect(isSandboxSender({ EMAIL_FROM_ADDRESS: 'onboarding@resend.dev' })).toBe(true)
    expect(isSandboxSender({ EMAIL_FROM_ADDRESS: 'Acme <Onboarding@Resend.dev>' })).toBe(true)
    expect(isSandboxSender({})).toBe(true)
    expect(isSandboxSender(live)).toBe(false)
  })
})

describe('mailRefusal', () => {
  it('always lets login codes through, even on a preview with the sandbox sender', () => {
    expect(
      mailRefusal('login-code', { VERCEL_ENV: 'preview', EMAIL_FROM_ADDRESS: 'a@resend.dev' }),
    ).toBeNull()
  })

  it('opens general mail in production and locally with a verified sender', () => {
    expect(mailRefusal('general', { ...live, VERCEL_ENV: 'production' })).toBeNull()
    expect(mailRefusal('general', live)).toBeNull()
  })

  it('refuses non-login mail on a preview, even with the production key and sender', () => {
    expect(mailRefusal('general', { ...live, VERCEL_ENV: 'preview' })).toBe('preview_deployment')
    expect(mailRefusal('operator', { ...live, VERCEL_ENV: 'preview' })).toBe('preview_deployment')
  })

  it('refuses general mail from the sandbox sender, but not operator mail to the owner', () => {
    const sandbox = { RESEND_API_KEY: 're_test', EMAIL_FROM_ADDRESS: 'Acme <a@resend.dev>' }
    expect(mailRefusal('general', sandbox)).toBe('sandbox_sender')
    expect(mailRefusal('operator', sandbox)).toBeNull()
  })
})

describe('sendMail', () => {
  const message = { to: 'someone@example.com', subject: 'Hi', text: 'Hello' }

  it('sends allowed mail through Payload', async () => {
    const payload = { sendEmail: vi.fn().mockResolvedValue({}) }
    await expect(sendMail(payload, 'general', message, live)).resolves.toEqual({ sent: true })
    expect(payload.sendEmail).toHaveBeenCalledWith(message)
  })

  it('never calls Payload for refused mail', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const payload = { sendEmail: vi.fn() }
    await expect(
      sendMail(payload, 'general', message, { ...live, VERCEL_ENV: 'preview' }),
    ).resolves.toEqual({ sent: false, reason: 'preview_deployment' })
    expect(payload.sendEmail).not.toHaveBeenCalled()
  })

  it('reports a missing provider instead of pretending', async () => {
    const payload = { sendEmail: vi.fn() }
    await expect(
      sendMail(payload, 'operator', message, { EMAIL_FROM_ADDRESS: 'x@acme.example' }),
    ).resolves.toEqual({ sent: false, reason: 'no_email_provider' })
    expect(payload.sendEmail).not.toHaveBeenCalled()
  })
})

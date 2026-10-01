import { z } from 'zod'

export const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  source: z.string().trim().max(64).optional(),
  // Honeypot: hidden from humans, bots tend to fill it.
  company: z.string().max(0).optional(),
})

export type WaitlistInput = z.infer<typeof waitlistSchema>

/** Codes, not copy: the form translates them (messages/<locale>.json → Waitlist.errors). */
export type WaitlistError = 'invalid_email' | 'invalid_request' | 'server'

export type WaitlistState =
  { status: 'idle' } | { status: 'success' } | { status: 'error'; error: WaitlistError }

export const initialWaitlistState: WaitlistState = { status: 'idle' }

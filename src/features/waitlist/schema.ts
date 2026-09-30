import { z } from 'zod'

export const waitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Enter a valid email address.' }).max(254)),
  source: z.string().trim().max(64).optional(),
  // Honeypot: hidden from humans, bots tend to fill it.
  company: z.string().max(0).optional(),
})

export type WaitlistInput = z.infer<typeof waitlistSchema>

export type WaitlistState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string; fieldErrors?: { email?: string[] } }

export const initialWaitlistState: WaitlistState = { status: 'idle' }

import 'server-only'

import type { Payload } from 'payload'

import type { WaitlistInput } from './schema'

export type JoinWaitlistResult = { created: boolean }

export async function joinWaitlist(
  payload: Payload,
  { email, source }: Pick<WaitlistInput, 'email' | 'source'>,
): Promise<JoinWaitlistResult> {
  const existing = await payload.count({
    collection: 'waitlist-signups',
    where: { email: { equals: email } },
  })
  if (existing.totalDocs > 0) return { created: false }

  await payload.create({
    collection: 'waitlist-signups',
    data: { email, source },
  })
  return { created: true }
}

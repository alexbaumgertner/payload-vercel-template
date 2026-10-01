import 'server-only'

import type { Payload } from 'payload'

import type { WaitlistInput } from './schema'

export type JoinWaitlistResult = { created: boolean }

async function isListed(payload: Payload, email: string): Promise<boolean> {
  const { totalDocs } = await payload.count({
    collection: 'waitlist-signups',
    where: { email: { equals: email } },
  })
  return totalDocs > 0
}

export async function joinWaitlist(
  payload: Payload,
  { email, source }: Pick<WaitlistInput, 'email' | 'source'>,
): Promise<JoinWaitlistResult> {
  if (await isListed(payload, email)) return { created: false }

  try {
    await payload.create({
      collection: 'waitlist-signups',
      data: { email, source },
    })
    return { created: true }
  } catch (error) {
    // A double submit can pass the check above twice; the unique index lets one insert win.
    if (await isListed(payload, email)) return { created: false }
    throw error
  }
}

'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import { track } from '@/lib/analytics'
import { captureServerError, monitorAction } from '@/lib/monitoring/server'
import { getPayloadClient } from '@/lib/payload'

import { waitlistSchema, type WaitlistState } from './schema'
import { joinWaitlist } from './service'

export async function joinWaitlistAction(
  prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  return monitorAction('joinWaitlistAction', () => handleJoin(prev, formData))
}

async function handleJoin(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const parsed = waitlistSchema.safeParse({
    email: formData.get('email') ?? '',
    source: formData.get('source') ?? undefined,
    company: formData.get('company') ?? undefined,
  })

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error)
    if (fieldErrors.company) return { status: 'success' }
    return { status: 'error', error: fieldErrors.email ? 'invalid_email' : 'invalid_request' }
  }

  try {
    const payload = await getPayloadClient()
    // Same response for new and existing emails so the form can't be used to probe the list.
    const { created } = await joinWaitlist(payload, parsed.data)
    if (created) {
      await track('waitlist_joined', { source: parsed.data.source || 'unknown' }, headers)
    }
    return { status: 'success' }
  } catch (error) {
    console.error('[waitlist] failed to save signup', error)
    await captureServerError(error, 'waitlist')
    return { status: 'error', error: 'server' }
  }
}

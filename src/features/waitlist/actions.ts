'use server'

import { z } from 'zod'

import { captureServerError, monitorAction } from '@/lib/monitoring/server'
import { getPayloadClient } from '@/lib/payload'

import { waitlistSchema, type WaitlistState } from './schema'
import { joinWaitlist } from './service'

const SUCCESS_MESSAGE = "You're on the list. We'll email you when there's something worth seeing."

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
    if (fieldErrors.company) return { status: 'success', message: SUCCESS_MESSAGE }
    return {
      status: 'error',
      message: 'Please check the highlighted field.',
      fieldErrors: { email: fieldErrors.email },
    }
  }

  try {
    const payload = await getPayloadClient()
    // Same response for new and existing emails so the form can't be used to probe the list.
    await joinWaitlist(payload, parsed.data)
    return { status: 'success', message: SUCCESS_MESSAGE }
  } catch (error) {
    console.error('[waitlist] failed to save signup', error)
    await captureServerError(error, 'waitlist')
    return { status: 'error', message: 'Something went wrong on our side. Please try again.' }
  }
}

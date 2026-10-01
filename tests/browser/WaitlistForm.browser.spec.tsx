import { beforeEach, describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { WaitlistForm } from '@/components/WaitlistForm/WaitlistForm'
import type { WaitlistState } from '@/features/waitlist/schema'

const { joinWaitlistAction } = vi.hoisted(() => ({
  joinWaitlistAction: vi.fn<(prev: WaitlistState, formData: FormData) => Promise<WaitlistState>>(),
}))

vi.mock('@/features/waitlist/actions', () => ({ joinWaitlistAction }))

describe('WaitlistForm', () => {
  beforeEach(() => {
    joinWaitlistAction.mockReset()
  })

  test('disables the form while the action is pending', async () => {
    let resolve!: (state: WaitlistState) => void
    joinWaitlistAction.mockReturnValue(new Promise((r) => (resolve = r)))
    await render(<WaitlistForm source="hero" />)

    await page.getByPlaceholder('you@company.com').fill('founder@example.com')
    await page.getByRole('button', { name: 'Join the waitlist' }).click()

    await expect.element(page.getByRole('button', { name: 'Joining…' })).toBeDisabled()
    resolve({ status: 'success', message: "You're on the list." })
    await expect.element(page.getByRole('status')).toHaveTextContent("You're on the list.")
  })

  test('submits the source and leaves the honeypot empty', async () => {
    joinWaitlistAction.mockResolvedValue({ status: 'success', message: 'ok' })
    await render(<WaitlistForm source="footer" />)

    await page.getByPlaceholder('you@company.com').fill('founder@example.com')
    await page.getByRole('button', { name: 'Join the waitlist' }).click()

    await expect.element(page.getByRole('status')).toBeVisible()
    const formData = joinWaitlistAction.mock.calls[0]?.[1]
    expect(formData?.get('source')).toBe('footer')
    expect(formData?.get('company')).toBe('')
  })

  test('keyboard users never land on the honeypot', async () => {
    await render(<WaitlistForm source="hero" />)

    await userEvent.tab()
    await expect.element(page.getByPlaceholder('you@company.com')).toHaveFocus()
    await userEvent.tab()
    await expect.element(page.getByRole('button', { name: 'Join the waitlist' })).toHaveFocus()
  })
})

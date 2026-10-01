import { beforeEach, describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { EmailCodeLogin } from '@/components/admin/EmailCodeLogin/EmailCodeLogin'
import type { LoginState } from '@/features/auth/schema'

const { loginAction } = vi.hoisted(() => ({
  loginAction: vi.fn<(prev: LoginState, formData: FormData) => Promise<LoginState>>(),
}))

vi.mock('@/features/auth/actions', () => ({ loginAction }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('redirect=/admin/collections/users'),
}))

describe('EmailCodeLogin', () => {
  beforeEach(() => {
    loginAction.mockReset()
  })

  test('moves from the email step to the code step', async () => {
    loginAction.mockImplementation(async (_prev, formData) => ({
      step: 'code',
      email: String(formData.get('email')),
    }))
    await render(<EmailCodeLogin />)

    await page.getByLabelText('Email').fill('founder@example.com')
    await page.getByRole('button', { name: 'Send login code' }).click()

    await expect.element(page.getByLabelText('Code')).toBeVisible()
    await expect.element(page.getByText('founder@example.com')).toBeVisible()

    const formData = loginAction.mock.calls[0]?.[1]
    expect(formData?.get('intent')).toBe('request')
    expect(formData?.get('redirect')).toBe('/admin/collections/users')
  })

  test('shows the server error and keeps the typed email', async () => {
    loginAction.mockImplementation(async (_prev, formData) => ({
      step: 'email',
      email: String(formData.get('email')),
      error: 'Enter a valid email address.',
    }))
    await render(<EmailCodeLogin />)

    const email = page.getByLabelText('Email')
    await email.fill('nope')
    await page.getByRole('button', { name: 'Send login code' }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent('Enter a valid email address.')
    await expect.element(email).toHaveValue('nope')
    await expect.element(email).toHaveAttribute('aria-invalid', 'true')
  })

  test('"Use another email" sends the restart intent', async () => {
    loginAction
      .mockResolvedValueOnce({ step: 'code', email: 'founder@example.com' })
      .mockResolvedValueOnce({ step: 'email', email: 'founder@example.com' })
    await render(<EmailCodeLogin />)

    await page.getByLabelText('Email').fill('founder@example.com')
    await page.getByRole('button', { name: 'Send login code' }).click()
    await page.getByRole('button', { name: 'Use another email' }).click()

    await expect.element(page.getByLabelText('Email')).toHaveValue('founder@example.com')
    expect(loginAction.mock.calls[1]?.[1].get('intent')).toBe('restart')
  })
})

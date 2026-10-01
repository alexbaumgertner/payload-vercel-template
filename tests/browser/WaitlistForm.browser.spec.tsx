import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { WaitlistForm } from '@/components/WaitlistForm/WaitlistForm'
import type { WaitlistError, WaitlistState } from '@/features/waitlist/schema'
import type { Locale } from '@/i18n/routing'

import en from '../../messages/en.json'
import ru from '../../messages/ru.json'

const { joinWaitlistAction } = vi.hoisted(() => ({
  joinWaitlistAction: vi.fn<(prev: WaitlistState, formData: FormData) => Promise<WaitlistState>>(),
}))

vi.mock('@/features/waitlist/actions', () => ({ joinWaitlistAction }))

const messages = { en, ru }

function renderForm(source: string, locale: Locale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <WaitlistForm source={source} />
    </NextIntlClientProvider>,
  )
}

describe('WaitlistForm', () => {
  beforeEach(() => {
    joinWaitlistAction.mockReset()
  })

  test('disables the form while the action is pending', async () => {
    let resolve!: (state: WaitlistState) => void
    joinWaitlistAction.mockReturnValue(new Promise((r) => (resolve = r)))
    await renderForm('hero')

    await page.getByPlaceholder('you@company.com').fill('founder@example.com')
    await page.getByRole('button', { name: 'Join the waitlist' }).click()

    await expect.element(page.getByRole('button', { name: 'Joining…' })).toBeDisabled()
    resolve({ status: 'success' })
    await expect.element(page.getByRole('status')).toHaveTextContent(en.Waitlist.success)
  })

  test('submits the source and leaves the honeypot empty', async () => {
    joinWaitlistAction.mockResolvedValue({ status: 'success' })
    await renderForm('footer')

    await page.getByPlaceholder('you@company.com').fill('founder@example.com')
    await page.getByRole('button', { name: 'Join the waitlist' }).click()

    await expect.element(page.getByRole('status')).toBeVisible()
    const formData = joinWaitlistAction.mock.calls[0]?.[1]
    expect(formData?.get('source')).toBe('footer')
    expect(formData?.get('company')).toBe('')
  })

  test('keyboard users never land on the honeypot', async () => {
    await renderForm('hero')

    await userEvent.tab()
    await expect.element(page.getByPlaceholder('you@company.com')).toHaveFocus()
    await userEvent.tab()
    await expect.element(page.getByRole('button', { name: 'Join the waitlist' })).toHaveFocus()
  })

  test.each<[Locale, WaitlistError, string, string]>([
    ['en', 'invalid_email', 'Join the waitlist', 'Enter a valid email address.'],
    [
      'ru',
      'invalid_email',
      'Записаться в лист ожидания',
      'Введите корректный адрес электронной почты.',
    ],
    ['en', 'server', 'Join the waitlist', 'Something went wrong on our side. Please try again.'],
    [
      'ru',
      'server',
      'Записаться в лист ожидания',
      'У нас что-то пошло не так. Попробуйте ещё раз.',
    ],
  ])('shows the %s message for %s', async (locale, error, submit, message) => {
    joinWaitlistAction.mockResolvedValue({ status: 'error', error })
    await renderForm('hero', locale)

    await page.getByRole('button', { name: submit }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent(message)
    await expect
      .element(page.getByPlaceholder('you@company.com'))
      .toHaveAttribute('aria-invalid', String(error === 'invalid_email'))
  })

  test('confirms the signup in Russian', async () => {
    joinWaitlistAction.mockResolvedValue({ status: 'success' })
    await renderForm('hero', 'ru')

    await page.getByPlaceholder('you@company.com').fill('founder@example.com')
    await page.getByRole('button', { name: 'Записаться в лист ожидания' }).click()

    await expect.element(page.getByRole('status')).toHaveTextContent(ru.Waitlist.success)
  })
})

// @vitest-environment jsdom

import '@testing-library/jest-dom'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LoginForm } from '@/app/(frontend)/login/LoginForm'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { PasswordLoginProvider } from '@/ui/web/providers/PasswordLoginProvider'
import enMessages from '../../src/i18n/en.json'
import heMessages from '../../src/i18n/he.json'

// Mock the login action to prevent actual API calls
vi.mock('@/app/(frontend)/login/login_authenticate-action', () => ({
  loginAction: vi.fn().mockResolvedValue({ success: false, error: 'invalidCredentials' }),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(null),
  }),
  usePathname: vi.fn().mockReturnValue('/login'),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const renderWithPasswordEnabled = (children: React.ReactNode) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      <PasswordLoginProvider enabled={true}>{children}</PasswordLoginProvider>
    </I18nProvider>,
  )
}

const renderWithPasswordEnabledHebrew = (children: React.ReactNode) => {
  return render(
    <I18nProvider locale="he" messages={heMessages}>
      <PasswordLoginProvider enabled={true}>{children}</PasswordLoginProvider>
    </I18nProvider>,
  )
}

describe('Login Form Client-Side Validation - Issue #1497', () => {
  describe('Empty email field validation', () => {
    it('shows error message when email field is empty on submit (English)', async () => {
      renderWithPasswordEnabled(<LoginForm />)

      // Submit the form without entering email by clicking the submit button
      const submitButton = screen.getByRole('button', { name: /log in/i })
      fireEvent.click(submitButton)

      // Wait for any validation to complete
      await waitFor(() => {})

      // The form should show a validation error for the empty email field
      // Expected: "Email is required" or similar validation message
      // This will fail because the current implementation doesn't show custom error messages
      const emailError = screen.getByText(/email.*required/i)
      expect(emailError).toBeInTheDocument()
    })

    it('shows error message when email field is empty on submit (Hebrew)', async () => {
      renderWithPasswordEnabledHebrew(<LoginForm />)

      // Submit the form without entering email
      const submitButton = screen.getByRole('button', { name: /התחבר/i })
      fireEvent.click(submitButton)

      await waitFor(() => {})

      // The form should show a validation error for the empty email field
      // Expected: Hebrew validation message for required email
      const emailError = screen.getByText(/אימייל.*נדרש|דוא"ל.*נדרש/i)
      expect(emailError).toBeInTheDocument()
    })
  })

  describe('Empty password field validation', () => {
    it('shows error message when password field is empty on submit (English)', async () => {
      renderWithPasswordEnabled(<LoginForm />)

      // Submit the form without entering password
      const submitButton = screen.getByRole('button', { name: /log in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {})

      // The form should show a validation error for the empty password field
      // Expected: "Password is required" or similar validation message
      const passwordError = screen.getByText(/password.*required/i)
      expect(passwordError).toBeInTheDocument()
    })

    it('shows error message when password field is empty on submit (Hebrew)', async () => {
      renderWithPasswordEnabledHebrew(<LoginForm />)

      // Submit the form without entering password
      const submitButton = screen.getByRole('button', { name: /התחבר/i })
      fireEvent.click(submitButton)

      await waitFor(() => {})

      // The form should show a validation error for the empty password field
      // Expected: Hebrew validation message for required password
      const passwordError = screen.getByText(/סיסמה.*נדרשת/i)
      expect(passwordError).toBeInTheDocument()
    })
  })

  describe('Both fields empty validation', () => {
    it('shows error messages for both email and password when both are empty (English)', async () => {
      renderWithPasswordEnabled(<LoginForm />)

      // Submit the form without entering anything
      const submitButton = screen.getByRole('button', { name: /log in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {})

      // Both validation errors should be visible
      expect(screen.getByText(/email.*required/i)).toBeInTheDocument()
      expect(screen.getByText(/password.*required/i)).toBeInTheDocument()
    })
  })
})

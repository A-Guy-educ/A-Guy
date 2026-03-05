/**
 * Unit Tests for LoginForm Component
 *
 * Tests that the LoginForm component renders correctly with the new design:
 * - Card has max-w-md class (wider card)
 * - Card has shadow-lg class (prominent shadow)
 * - Card has rounded-xl class
 * - Decorative line element exists
 * - Signup CTA button/link exists pointing to /signup
 * - Footer text appears
 */
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { PasswordLoginProvider } from '@/ui/web/providers/PasswordLoginProvider'
import { LoginForm } from '@/app/(frontend)/login/LoginForm'
import enMessages from '@/i18n/en.json'

// Mock next/navigation with all required exports
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/login',
}))

// Mock the login action
vi.mock('@/app/(frontend)/login/login_authenticate-action', () => ({
  loginAction: vi.fn(),
}))

// Mock GoogleLoginButton
vi.mock('@/ui/web/auth/GoogleLoginButton', () => ({
  GoogleLoginButton: () => <button data-testid="google-login">Sign in with Google</button>,
}))

const MockProviders = ({
  children,
  passwordEnabled = false,
}: {
  children: React.ReactNode
  passwordEnabled?: boolean
}) => {
  return (
    <I18nProvider locale="en" messages={enMessages}>
      <PasswordLoginProvider enabled={passwordEnabled}>{children}</PasswordLoginProvider>
    </I18nProvider>
  )
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  describe('Google-only mode (passwordEnabled: false)', () => {
    it('should render card with max-w-md class', async () => {
      render(
        <MockProviders passwordEnabled={false}>
          <LoginForm />
        </MockProviders>,
      )

      await waitFor(() => {
        const element = document.querySelector('[class*="max-w-md"]')
        expect(element).toBeTruthy()
      })
    })

    it('should render card with shadow-lg class', async () => {
      render(
        <MockProviders passwordEnabled={false}>
          <LoginForm />
        </MockProviders>,
      )

      await waitFor(() => {
        const element = document.querySelector('[class*="shadow-lg"]')
        expect(element).toBeTruthy()
      })
    })

    it('should render card with rounded-xl class', async () => {
      render(
        <MockProviders passwordEnabled={false}>
          <LoginForm />
        </MockProviders>,
      )

      await waitFor(() => {
        const element = document.querySelector('[class*="rounded-xl"]')
        expect(element).toBeTruthy()
      })
    })

    it('should render decorative line element', async () => {
      render(
        <MockProviders passwordEnabled={false}>
          <LoginForm />
        </MockProviders>,
      )

      await waitFor(() => {
        const decorativeLine = document.querySelector(
          'div[class*="w-12"][class*="h-0.5"][class*="bg-accent"]',
        )
        expect(decorativeLine).toBeTruthy()
      })
    })

    it('should render Quick Entry section label', async () => {
      render(
        <MockProviders passwordEnabled={false}>
          <LoginForm />
        </MockProviders>,
      )

      await waitFor(() => {
        const elements = screen.queryAllByText('Quick Entry')
        expect(elements.length).toBeGreaterThan(0)
      })
    })

    it('should render Signup CTA button', async () => {
      render(
        <MockProviders passwordEnabled={false}>
          <LoginForm />
        </MockProviders>,
      )

      await waitFor(() => {
        const elements = screen.queryAllByText('Free Registration')
        expect(elements.length).toBeGreaterThan(0)
      })
    })

    it('should have Signup CTA link pointing to /signup', async () => {
      render(
        <MockProviders passwordEnabled={false}>
          <LoginForm />
        </MockProviders>,
      )

      await waitFor(() => {
        const signupLink = document.querySelector('a[href="/signup"]')
        expect(signupLink).toBeTruthy()
      })
    })

    it('should render footer secure text', async () => {
      render(
        <MockProviders passwordEnabled={false}>
          <LoginForm />
        </MockProviders>,
      )

      await waitFor(() => {
        const elements = screen.queryAllByText('Fast and secure access.')
        expect(elements.length).toBeGreaterThan(0)
      })
    })

    it('should render footer one click text', async () => {
      render(
        <MockProviders passwordEnabled={false}>
          <LoginForm />
        </MockProviders>,
      )

      await waitFor(() => {
        const elements = screen.queryAllByText("One click and you're in.")
        expect(elements.length).toBeGreaterThan(0)
      })
    })

    it('should NOT render password form when passwordEnabled is false', async () => {
      render(
        <MockProviders passwordEnabled={false}>
          <LoginForm />
        </MockProviders>,
      )

      await waitFor(() => {
        expect(screen.queryByLabelText('Email')).toBeNull()
        expect(screen.queryByLabelText('Password')).toBeNull()
      })
    })
  })

  describe('Password enabled mode (passwordEnabled: true)', () => {
    it('should render password form when passwordEnabled is true', async () => {
      render(
        <MockProviders passwordEnabled={true}>
          <LoginForm />
        </MockProviders>,
      )

      await waitFor(() => {
        expect(screen.getByLabelText('Email')).toBeTruthy()
        expect(screen.getByLabelText('Password')).toBeTruthy()
      })
    })

    it('should render Login button', async () => {
      render(
        <MockProviders passwordEnabled={true}>
          <LoginForm />
        </MockProviders>,
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy()
      })
    })
  })
})

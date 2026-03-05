/**
 * Unit Tests for LoginPageContent Component
 *
 * Tests that the LoginPageContent component renders correctly with the new design:
 * - Full-page bg-muted background
 * - Headline h1 element
 * - Help link at bottom of page
 */
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { LoginPageContent } from '@/app/(frontend)/login/LoginPageContent'
import enMessages from '@/i18n/en.json'

// Mock the LoginForm component
vi.mock('@/app/(frontend)/login/LoginForm', () => ({
  LoginForm: () => <div data-testid="login-form">LoginForm</div>,
}))

// Mock next/navigation with all required exports
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/login',
}))

const MockI18nProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <I18nProvider locale="en" messages={enMessages}>
      {children}
    </I18nProvider>
  )
}

describe('LoginPageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('should render with full-page background container', async () => {
    render(
      <MockI18nProvider>
        <LoginPageContent />
      </MockI18nProvider>,
    )

    await waitFor(() => {
      const element = document.querySelector('[class*="min-h-screen"][class*="bg-muted"]')
      expect(element).toBeTruthy()
    })
  })

  it('should render headline h1 element', async () => {
    render(
      <MockI18nProvider>
        <LoginPageContent />
      </MockI18nProvider>,
    )

    await waitFor(() => {
      const headline = screen.getByRole('heading', { level: 1 })
      expect(headline).toBeTruthy()
      expect(headline.textContent).toBe('Hello, ready to succeed?')
    })
  })

  it('should render subtitle below headline', async () => {
    render(
      <MockI18nProvider>
        <LoginPageContent />
      </MockI18nProvider>,
    )

    await waitFor(() => {
      const subtitle = screen.getByText('A-Guy — your personal tutor')
      expect(subtitle).toBeTruthy()
    })
  })

  it('should render LoginForm component', async () => {
    render(
      <MockI18nProvider>
        <LoginPageContent />
      </MockI18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('login-form')).toBeTruthy()
    })
  })

  it('should render help link at bottom of page', async () => {
    render(
      <MockI18nProvider>
        <LoginPageContent />
      </MockI18nProvider>,
    )

    await waitFor(() => {
      const helpLink = document.querySelector('a[href="/help"]')
      expect(helpLink).toBeTruthy()
    })
  })
})

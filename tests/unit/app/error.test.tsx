// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../src/i18n/en.json'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: new URLSearchParams(),
}))

const renderWithI18n = (component: React.ReactElement) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      {component}
    </I18nProvider>,
  )
}

describe('Error component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders error title and message', async () => {
    const ErrorPage = (await import('@/app/(frontend)/error')).default
    const mockReset = vi.fn()

    renderWithI18n(<ErrorPage error={new Error('test error')} reset={mockReset} />)

    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeTruthy()
  })

  it('renders retry button that calls reset()', async () => {
    const ErrorPage = (await import('@/app/(frontend)/error')).default
    const mockReset = vi.fn()

    const { container } = renderWithI18n(
      <ErrorPage error={new Error('test error')} reset={mockReset} />,
    )

    // Find button by its role and click it
    const buttons = container.querySelectorAll('button')
    const retryButton = buttons[0]
    retryButton.click()

    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it('renders go home link pointing to /', async () => {
    const ErrorPage = (await import('@/app/(frontend)/error')).default
    const mockReset = vi.fn()

    const { container } = renderWithI18n(
      <ErrorPage error={new Error('test error')} reset={mockReset} />,
    )

    // Find the link inside the second button (asChild)
    const link = container.querySelector('a[href="/"]')
    expect(link).not.toBeNull()
  })

  it('is a client component', () => {
    const fs = require('fs')
    const path = require('path')
    const filePath = path.resolve(__dirname, '../../../src/app/(frontend)/error.tsx')
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // First non-empty line should be 'use client'
    const firstLine = fileContent.trim().split('\n')[0].trim()
    expect(firstLine).toBe("'use client'")
  })

  it('logs error to console on mount', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ErrorPage = (await import('@/app/(frontend)/error')).default
    const mockReset = vi.fn()

    renderWithI18n(<ErrorPage error={new Error('test error')} reset={mockReset} />)

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('does NOT render the raw error message in the DOM', async () => {
    const ErrorPage = (await import('@/app/(frontend)/error')).default
    const mockReset = vi.fn()

    renderWithI18n(<ErrorPage error={new Error('sensitive-server-info-xyz')} reset={mockReset} />)

    expect(screen.queryByText('sensitive-server-info-xyz')).toBeNull()
  })
})

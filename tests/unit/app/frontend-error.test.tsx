// @vitest-environment jsdom
import React from 'react'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import enMessages from '../../../src/i18n/en.json'

// Import Error component - using alias to avoid conflict with JavaScript Error class
import ErrorComponent from '@/app/(frontend)/error'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

const renderWithI18n = (component: React.ReactElement) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      {component}
    </I18nProvider>,
  )
}

// Helper to create mock error objects
const createMockError = (message: string, digest?: string): Error & { digest?: string } => {
  const error = new Error(message) as Error & { digest?: string }
  if (digest) {
    error.digest = digest
  }
  return error
}

describe('Error component', () => {
  it('renders error message with i18n and accessibility', () => {
    const mockError = createMockError('Test error')
    const mockReset = vi.fn()

    renderWithI18n(<ErrorComponent error={mockError} reset={mockReset} />)

    // Assert role="alert" container exists
    const alertContainer = screen.getByRole('alert')
    expect(alertContainer).toBeTruthy()

    // Assert aria-live="polite" attribute is present
    expect(alertContainer.getAttribute('aria-live')).toBe('polite')

    // Assert text "Something went wrong" is visible (from en translations)
    expect(screen.getByText('Something went wrong')).toBeTruthy()

    // Assert a button with text "Try again" is visible
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('retry button calls reset', () => {
    const mockError = createMockError('Test error')
    const mockReset = vi.fn()

    renderWithI18n(<ErrorComponent error={mockError} reset={mockReset} />)

    // Click the "Try again" button
    const retryButton = screen.getByRole('button', { name: 'Try again' })
    fireEvent.click(retryButton)

    // Assert reset was called exactly once
    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it('renders with error digest if provided', () => {
    const mockError = createMockError('Test error', 'test-digest-123')
    const mockReset = vi.fn()

    // Should render without throwing even with digest
    expect(() => {
      renderWithI18n(<ErrorComponent error={mockError} reset={mockReset} />)
    }).not.toThrow()
  })
})

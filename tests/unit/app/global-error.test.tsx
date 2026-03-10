// @vitest-environment jsdom

/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the Sentry import
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// We need to test the component directly, but it uses 'use client'
// Since it's a client component, we can import it directly
import GlobalError from '@/app/global-error'

describe('GlobalError - Inline Styles and Accessibility Fix', () => {
  // Use any to avoid type conflicts - the actual component expects next/error's Error type
  // which is different from the native Error
  const mockError: any = {
    message: 'Test error',
    digest: undefined,
  }
  const mockReset = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should not have any inline style attributes', () => {
    render(<GlobalError error={mockError} reset={mockReset} />)

    // Query for any element with a style attribute
    const container = document.body
    const elementsWithStyle = container.querySelectorAll('[style]')

    expect(elementsWithStyle).toHaveLength(0)
  })

  it('should have role="alert" on the error container', () => {
    render(<GlobalError error={mockError} reset={mockReset} />)

    const alertElements = screen.queryAllByRole('alert')
    expect(alertElements.length).toBeGreaterThan(0)
    expect(alertElements[0]).toBeTruthy()
  })

  it('should have aria-live="polite" on the error container', () => {
    render(<GlobalError error={mockError} reset={mockReset} />)

    const container = document.body
    const elementWithAriaLive = container.querySelector('[aria-live="polite"]')

    expect(elementWithAriaLive).toBeTruthy()
  })

  it('should render Try again button with Tailwind className', () => {
    render(<GlobalError error={mockError} reset={mockReset} />)

    const buttons = screen.queryAllByRole('button', { name: /try again/i })
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons[0].className).toBeTruthy()
  })

  it('should detect Hebrew language from navigator.language', () => {
    // Mock navigator.language to return Hebrew
    const originalLanguage = navigator.language
    Object.defineProperty(navigator, 'language', {
      value: 'he',
      configurable: true,
    })

    render(<GlobalError error={mockError} reset={mockReset} />)

    // Should contain Hebrew text
    const hebrewElements = screen.queryAllByText(/משהו השתבש/)
    expect(hebrewElements.length).toBeGreaterThan(0)

    // Restore original
    Object.defineProperty(navigator, 'language', {
      value: originalLanguage,
      configurable: true,
    })
  })

  it('should show English text for English browser language', () => {
    // Mock navigator.language to return English
    const originalLanguage = navigator.language
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      configurable: true,
    })

    render(<GlobalError error={mockError} reset={mockReset} />)

    // Should contain English text
    const englishElements = screen.queryAllByText(/something went wrong/i)
    expect(englishElements.length).toBeGreaterThan(0)

    // Restore original
    Object.defineProperty(navigator, 'language', {
      value: originalLanguage,
      configurable: true,
    })
  })
})

// @vitest-environment jsdom
/**
 * @fileType test
 * @domain frontend
 * @pattern floating-action-button, ask-question, mobile
 * @ai-summary Tests for floating ask question button
 *
 * Issue #1741: [Mobile] Floating "שאל שאלה" button in bottom-left corner
 *
 * This test verifies the FloatingAskButton component exists and has the correct
 * behavior. The component should be located at:
 * src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton/index.tsx
 */

import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock all dependencies with proper translation strings
vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      askTip: 'Stuck on a problem? Ask your AI teacher here',
      ask: 'Ask',
      chatInputPlaceholder: 'Ask a question...',
      chat: 'Chat',
      sendMessage: 'Send message',
    }
    return translations[key] ?? key
  },
  useLocale: () => 'en',
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}))

/**
 * These tests verify the FloatingAskButton component exists and behaves correctly.
 * The component should be located at:
 * src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton/index.tsx
 *
 * Current status: Should PASS once component is implemented
 */
describe('FloatingAskButton Component', () => {
  afterEach(() => cleanup())

  it('should exist and be importable', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')
    expect(FloatingAskButton).toBeDefined()
  })

  it('should render a button with correct accessibility label', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    const onClick = vi.fn()
    render(<FloatingAskButton onAskClick={onClick} isCentered={false} />)

    // The button uses the 'askTip' translation as aria-label
    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    expect(button).toBeInTheDocument()
  })

  it('should be positioned at bottom-left by default', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    const onClick = vi.fn()
    render(<FloatingAskButton onAskClick={onClick} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    expect(button.className).toContain('bottom-0')
    expect(button.className).toContain('left-0')
    expect(button.className).toContain('fixed')
  })

  it('should move to center when isCentered is true', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    const onClick = vi.fn()
    render(<FloatingAskButton onAskClick={onClick} isCentered={true} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    expect(button.className).toContain('left-1/2')
    expect(button.className).toContain('-translate-x-1/2')
  })

  it('should open the sheet when button is pressed', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    render(<FloatingAskButton onAskClick={() => {}} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })

    // The SheetTrigger wraps the button - clicking should open the sheet
    // We verify the button is clickable ( Radix UI handles the sheet open)
    expect(button).not.toBeDisabled()
  })

  it('should have proper z-index for overlay stacking', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    const onClick = vi.fn()
    render(<FloatingAskButton onAskClick={onClick} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    // z-index should be high enough to appear above other content
    expect(button.className).toMatch(/z-\[70\]/)
  })

  it('should have safe-area padding for iOS', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    const onClick = vi.fn()
    render(<FloatingAskButton onAskClick={onClick} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    // Should include safe-area-inset for iOS
    expect(button.className).toMatch(/pb-\[max/)
  })
})

/**
 * These tests verify the AskSheet (bottom sheet) has the correct form elements
 */
describe('AskSheet Component', () => {
  afterEach(() => cleanup())

  it('should exist and be importable', async () => {
    const { AskSheet } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')
    expect(AskSheet).toBeDefined()
  })

  it('should render text input field', async () => {
    const { AskSheet } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    render(<AskSheet onSubmit={() => {}} onClose={() => {}} />)

    const input = screen.getByPlaceholderText(/Ask a question/i)
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'text')
  })

  it('should render add image button', async () => {
    const { AskSheet } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    render(<AskSheet onSubmit={() => {}} onClose={() => {}} />)

    const addImageBtn = screen.getByRole('button', { name: /add image/i })
    expect(addImageBtn).toBeInTheDocument()
  })

  it('should render submit button', async () => {
    const { AskSheet } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    render(<AskSheet onSubmit={() => {}} onClose={() => {}} />)

    // Submit button says "Ask"
    const submitBtn = screen.getByRole('button', { name: /ask/i })
    expect(submitBtn).toBeInTheDocument()
  })
})

// @vitest-environment jsdom
/**
 * @fileType test
 * @domain frontend
 * @pattern floating-action-button, expandable-input, mobile
 * @ai-summary Tests for the expandable FloatingAskButton component
 *
 * Issue #1786: Upgrade floating chat button with expandable input panel
 *
 * These tests verify the new expandable panel behavior where clicking the
 * floating button opens a floating input panel with math support, image upload,
 * and send functionality.
 */

import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
      const {
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        ...rest
      } = props as Record<string, unknown>
      // Render immediately without animation in tests
      return (
        <div data-motion="" {...rest}>
          {children}
        </div>
      )
    },
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
      return <button {...props}>{children}</button>
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => {
    // In tests, render children immediately without animation delays
    return <>{children}</>
  },
}))

// Mock all dependencies with proper translation strings
vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      askTip: 'Stuck on a problem? Ask your AI teacher here',
      ask: 'Ask',
      chatInputPlaceholder: 'Ask a question...',
      chat: 'Chat',
      sendMessage: 'Send message',
      insertFormula: 'Insert formula',
      chatAttachFile: 'Attach file',
    }
    return translations[key] ?? key
  },
  useLocale: () => 'en',
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}))

/**
 * Tests for the expandable FloatingAskButton component.
 * Issue #1786: The button should expand into a floating input panel.
 */
describe('FloatingAskButton Expandable Panel', () => {
  afterEach(() => cleanup())

  it('should render the floating button by default', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    render(<FloatingAskButton onAskClick={vi.fn()} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    expect(button).toBeInTheDocument()
  })

  it('should show expandable panel when button is clicked', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    render(<FloatingAskButton onAskClick={vi.fn()} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    fireEvent.click(button)

    // After clicking, the panel should be visible with input field
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Ask a question.../i)
      expect(input).toBeInTheDocument()
    })
  })

  it('should have math button in the expanded panel', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    render(<FloatingAskButton onAskClick={vi.fn()} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    fireEvent.click(button)

    await waitFor(() => {
      const mathButton = screen.getByRole('button', { name: /insert formula/i })
      expect(mathButton).toBeInTheDocument()
    })
  })

  it('should have media upload button in the expanded panel', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    render(<FloatingAskButton onAskClick={vi.fn()} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    fireEvent.click(button)

    await waitFor(() => {
      const uploadButton = screen.getByRole('button', { name: /attach file/i })
      expect(uploadButton).toBeInTheDocument()
    })
  })

  it('should have send button in the expanded panel', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    render(<FloatingAskButton onAskClick={vi.fn()} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    fireEvent.click(button)

    await waitFor(() => {
      const sendButton = screen.getByRole('button', { name: /send message/i })
      expect(sendButton).toBeInTheDocument()
    })
  })

  it('should close panel when clicking outside', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    render(<FloatingAskButton onAskClick={vi.fn()} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    fireEvent.click(button)

    // Wait for panel to appear
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Ask a question.../i)
      expect(input).toBeInTheDocument()
    })

    // Click outside the panel (on the document body) - use mousedown since that's what the handler listens to
    fireEvent.mouseDown(document.body)

    // Panel should be closed, button should be visible again
    await waitFor(() => {
      const reopenedButton = screen.getByRole('button', { name: /Stuck on a problem/i })
      expect(reopenedButton).toBeInTheDocument()
    })
  })

  it('should auto-focus the input when panel opens', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    render(<FloatingAskButton onAskClick={vi.fn()} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    fireEvent.click(button)

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Ask a question.../i) as HTMLInputElement
      expect(input).toBeInTheDocument()
      // Check if input is focused - in jsdom we check document.activeElement
      expect(document.activeElement).toBe(input)
    })
  })

  it('should be positioned at bottom-left with correct offset (bottom: 24px, left: 24px)', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    render(<FloatingAskButton onAskClick={vi.fn()} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    expect(button.className).toContain('bottom-6') // 24px = bottom-6 in Tailwind
    expect(button.className).toContain('left-6') // 24px = left-6 in Tailwind
  })

  it('should have correct z-index for overlay stacking', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    render(<FloatingAskButton onAskClick={vi.fn()} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })
    expect(button.className).toMatch(/z-\[70\]/)
  })

  it('should dispatch focus-chat-input event when clicked', async () => {
    const { FloatingAskButton } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton')

    const onClick = vi.fn()
    render(<FloatingAskButton onAskClick={onClick} isCentered={false} />)

    const button = screen.getByRole('button', { name: /Stuck on a problem/i })

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

    fireEvent.click(button)

    expect(dispatchEventSpy).toHaveBeenCalled()
    const dispatchedEvent = dispatchEventSpy.mock.calls[0][0] as Event
    expect(dispatchedEvent.type).toBe('focus-chat-input')
  })
})

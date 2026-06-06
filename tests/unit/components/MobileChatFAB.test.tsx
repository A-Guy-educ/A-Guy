// @vitest-environment jsdom
/**
 * @fileType test
 * @domain frontend
 * @pattern mobile-chat, floating-action-button, bottom-sheet, chat-panel
 * @ai-summary Tests for mobile chat FAB (Floating Action Button) that opens a bottom panel
 *
 * Issue #2192: Add mobile chat FAB (button-to-open) on lesson pages
 *
 * This test verifies the MobileChatFAB component exists and has the correct behavior:
 * - FAB appears at bottom-left on mobile
 * - Tapping FAB opens a bottom panel
 * - Escape key and collapse button close the panel
 * - focus-chat-input event opens the panel
 */

import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock all dependencies with proper translation strings
vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      openChat: 'Open chat',
      closeChat: 'Close chat',
      chatPanelTitle: 'Chat',
      chatInputPlaceholder: 'Send a message...',
      chat: 'Chat',
      sendMessage: 'Send',
    }
    return translations[key] ?? key
  },
  useLocale: () => 'en',
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}))

/**
 * These tests verify the MobileChatFAB component exists and behaves correctly.
 * The component should be located at:
 * src/ui/web/chat/MobileChatFAB/index.tsx
 */
describe('MobileChatFAB Component', () => {
  afterEach(() => cleanup())

  it('should exist and be importable', async () => {
    const { MobileChatFAB } = await import('@/ui/web/chat/MobileChatFAB')
    expect(MobileChatFAB).toBeDefined()
  })

  it('should render FAB button when closed', async () => {
    const { MobileChatFAB } = await import('@/ui/web/chat/MobileChatFAB')
    const onOpen = vi.fn()
    const onClose = vi.fn()

    render(
      <MobileChatFAB isOpen={false} onOpen={onOpen} onClose={onClose}>
        <div>Chat content</div>
      </MobileChatFAB>,
    )

    const fabButton = screen.getByRole('button', { name: /Open chat/i })
    expect(fabButton).toBeInTheDocument()
  })

  it('should not render FAB button when open', async () => {
    const { MobileChatFAB } = await import('@/ui/web/chat/MobileChatFAB')
    const onOpen = vi.fn()
    const onClose = vi.fn()

    render(
      <MobileChatFAB isOpen={true} onOpen={onOpen} onClose={onClose}>
        <div>Chat content</div>
      </MobileChatFAB>,
    )

    const fabButton = screen.queryByRole('button', { name: /Open chat/i })
    expect(fabButton).not.toBeInTheDocument()
  })

  it('should render bottom panel when open', async () => {
    const { MobileChatFAB } = await import('@/ui/web/chat/MobileChatFAB')
    const onOpen = vi.fn()
    const onClose = vi.fn()

    render(
      <MobileChatFAB isOpen={true} onOpen={onOpen} onClose={onClose}>
        <div>Chat content</div>
      </MobileChatFAB>,
    )

    const panel = screen.getByRole('dialog', { name: /Chat/i })
    expect(panel).toBeInTheDocument()
  })

  it('should call onOpen when FAB is clicked', async () => {
    const { MobileChatFAB } = await import('@/ui/web/chat/MobileChatFAB')
    const onOpen = vi.fn()
    const onClose = vi.fn()

    render(
      <MobileChatFAB isOpen={false} onOpen={onOpen} onClose={onClose}>
        <div>Chat content</div>
      </MobileChatFAB>,
    )

    const fabButton = screen.getByRole('button', { name: /Open chat/i })
    fireEvent.click(fabButton)

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when collapse button is clicked', async () => {
    const { MobileChatFAB } = await import('@/ui/web/chat/MobileChatFAB')
    const onOpen = vi.fn()
    const onClose = vi.fn()

    render(
      <MobileChatFAB isOpen={true} onOpen={onOpen} onClose={onClose}>
        <div>Chat content</div>
      </MobileChatFAB>,
    )

    const collapseButton = screen.getByRole('button', { name: /Close chat/i })
    fireEvent.click(collapseButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when Escape key is pressed', async () => {
    const { MobileChatFAB } = await import('@/ui/web/chat/MobileChatFAB')
    const onOpen = vi.fn()
    const onClose = vi.fn()

    render(
      <MobileChatFAB isOpen={true} onOpen={onOpen} onClose={onClose}>
        <div>Chat content</div>
      </MobileChatFAB>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should render children inside the panel when open', async () => {
    const { MobileChatFAB } = await import('@/ui/web/chat/MobileChatFAB')
    const onOpen = vi.fn()
    const onClose = vi.fn()

    render(
      <MobileChatFAB isOpen={true} onOpen={onOpen} onClose={onClose}>
        <div data-testid="chat-content">Chat content</div>
      </MobileChatFAB>,
    )

    const chatContent = screen.getByTestId('chat-content')
    expect(chatContent).toBeInTheDocument()
  })

  it('should have correct positioning classes for FAB', async () => {
    const { MobileChatFAB } = await import('@/ui/web/chat/MobileChatFAB')
    const onOpen = vi.fn()
    const onClose = vi.fn()

    render(
      <MobileChatFAB isOpen={false} onOpen={onOpen} onClose={onClose}>
        <div>Chat content</div>
      </MobileChatFAB>,
    )

    const fabButton = screen.getByRole('button', { name: /Open chat/i }) as HTMLElement
    // FAB should always be on left side (bottom-left regardless of locale)
    expect(fabButton.className).toContain('left-6')
    expect(fabButton.className).toContain('fixed')
    // Bottom position lives in an inline style (calc with --mobile-chat-panel-h)
    // so the button can lift above the panel when it opens.
    expect(fabButton.style.bottom).toMatch(/var\(--mobile-chat-panel-h/)
  })
})

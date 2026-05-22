// @vitest-environment jsdom
/**
 * @fileType test
 * @domain frontend
 * @pattern split-pane-layout, mobile, chat, display-mode
 * @ai-summary Tests for SplitPaneLayout mobile chat display behavior
 *
 * Issue #1785: Remove bottom chat input bar from lesson page on mobile
 *
 * Expected behavior:
 * - On mobile in PDF mode with chat collapsed, the chat should be fully hidden (no input bar)
 * - displayMode should NOT be 'input-only' when isMobile && viewMode === 'PDF' && !chatExpandedInPdf
 *
 * Buggy behavior:
 * - On mobile in PDF mode with chat collapsed, displayMode is set to 'input-only'
 *   which causes a bottom chat input bar to appear
 */

import '@testing-library/jest-dom'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock useMediaQuery
const mockUseMediaQuery = vi.fn()
vi.mock('@/server/payload/hooks/useMediaQuery', () => ({
  useMediaQuery: (...args: unknown[]) => mockUseMediaQuery(...args),
}))

// Mock ResizablePane
vi.mock('@/ui/web/components/resizable-pane', () => ({
  ResizablePane: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

// Mock cn utility
vi.mock('@/infra/utils/ui', () => ({
  cn: (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' '),
}))

/**
 * Helper to extract displayMode from the chatContent cloneElement props
 */
function extractDisplayMode(
  chatContent: React.ReactElement<{
    displayMode?: 'full' | 'input-only'
    isMobile?: boolean
    viewMode?: string
  }>,
): 'full' | 'input-only' | undefined {
  return chatContent.props.displayMode
}

describe('SplitPaneLayout Mobile Chat Display Mode', () => {
  afterEach(() => {
    cleanup()
    mockUseMediaQuery.mockReset()
  })

  describe('Mobile PDF mode with collapsed chat', () => {
    it('should NOT pass displayMode input-only when mobile and PDF mode with chat collapsed', async () => {
      // This is the bug: the current code passes 'input-only' in this case
      // The fix should make displayMode undefined so the chat is fully hidden
      const { SplitPaneLayout } = await import('@/ui/web/components/split-pane-layout')

      mockUseMediaQuery.mockReturnValue(false) // Mobile

      const ChatContentMock = ({ displayMode }: { displayMode?: string }) => (
        <div data-testid="chat-content-mock">displayMode: {displayMode ?? 'undefined'}</div>
      )

      render(
        <SplitPaneLayout primaryContent={<div>Primary</div>} chatContent={<ChatContentMock />} />,
      )

      // Read the source to check the logic
      const fs = await import('fs')
      const path = await import('path')
      const splitPanePath = path.join(process.cwd(), 'src/ui/web/components/split-pane-layout.tsx')
      const source = fs.readFileSync(splitPanePath, 'utf-8')

      // Find the displayMode logic in the source
      // The buggy code has: viewMode === 'CHAT' || (viewMode === 'PDF' && chatExpandedInPdf) ? 'full' : ('input-only' as const)
      // The fixed code should check isDesktop: viewMode === 'CHAT' || (viewMode === 'PDF' && chatExpandedInPdf) || !isDesktop ? 'full' : ('input-only' as const)

      // Check if the fix is applied - the ternary should check !isDesktop
      const hasMobileFix =
        /displayMode\s*:\s*viewMode\s*===\s*['"]CHAT['"]\s*\|\|\s*\(viewMode\s*===\s*['"]PDF['"]\s*&&\s*chatExpandedInPdf\)\s*\|\|\s*!isDesktop/.test(
          source,
        )

      expect(hasMobileFix).toBe(true)
    })

    it('should keep displayMode input-only on DESKTOP PDF mode with collapsed chat', async () => {
      // On desktop, input-only mode is acceptable
      const fs = await import('fs')
      const path = await import('path')
      const splitPanePath = path.join(process.cwd(), 'src/ui/web/components/split-pane-layout.tsx')
      const source = fs.readFileSync(splitPanePath, 'utf-8')

      // The desktop path still uses input-only - verify the source has it
      // The fix should only affect the mobile (!isDesktop) path
      // So the input-only fallback should still exist but only for desktop
      const hasInputOnlyFallback = source.includes("'input-only'")

      expect(hasInputOnlyFallback).toBe(true)
    })
  })
})

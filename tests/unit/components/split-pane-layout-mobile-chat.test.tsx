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

  it('should always pass displayMode full on mobile in PDF mode with collapsed chat', async () => {
    // The fix: displayMode is always 'full' on mobile — the ternary is removed entirely
    const fs = await import('fs')
    const path = await import('path')
    const splitPanePath = path.join(process.cwd(), 'src/ui/web/components/split-pane-layout.tsx')
    const source = fs.readFileSync(splitPanePath, 'utf-8')

    // Verify the ternary is gone and displayMode is always 'full'
    const hasTernaryGone = /displayMode:\s*'full'/.test(source)
    expect(hasTernaryGone).toBe(true)

    // Verify 'input-only' is no longer in the source
    const hasInputOnly = /input-only/.test(source)
    expect(hasInputOnly).toBe(false)
  })
})

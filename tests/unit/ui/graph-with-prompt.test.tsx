// @vitest-environment jsdom
/**
 * Unit Tests: GraphWithPrompt Layout Component
 *
 * Tests for the GraphWithPrompt wrapper component that renders
 * prompt text alongside a graph renderer with configurable layout.
 * These tests validate:
 * 1. Correct DOM order for all 4 layout options
 * 2. Correct flex classes (flex-col for vertical, flex-row for horizontal)
 * 3. Default to textRight when no layout provided
 * 4. No responsive breakpoint classes for strict mobile enforcement
 */

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock RichTextRenderer since it's a dependency
vi.mock('@/ui/web/exerciserenderer/blocks/RichTextRenderer', () => ({
  RichTextRenderer: ({ block }: { block: { value: string } }) => (
    <div data-testid="prompt-renderer">{block.value}</div>
  ),
}))

// Type-only import - will fail at compile if component doesn't exist (expected in TDD)
import type { GraphLayout } from '@/server/payload/collections/Exercises/types'

// Import actual implementation
import { GraphWithPrompt } from '@/ui/web/exerciserenderer/blocks/GraphWithPrompt'

describe('GraphWithPrompt Component', () => {
  afterEach(() => {
    cleanup()
  })

  // Helper to create a mock prompt
  const mockPrompt = {
    type: 'rich_text' as const,
    format: 'md-math-v1' as const,
    value: 'Test prompt text',
    mediaIds: [] as string[],
  }

  // Helper to render component with a graph child
  const renderWithGraph = (layout?: 'textAbove' | 'textBelow' | 'textLeft' | 'textRight') => {
    const result = render(
      <GraphWithPrompt blockId="test-block" layout={layout} prompt={mockPrompt}>
        <div data-testid="graph-child">Graph Content</div>
      </GraphWithPrompt>,
    )
    return result
  }

  describe('textAbove layout', () => {
    it('renders prompt above graph with flex-col', () => {
      const { container } = renderWithGraph('textAbove')
      const wrapper = container.firstChild as HTMLElement

      // Should have flex-col class
      expect(wrapper.className).toContain('flex-col')
      // Prompt should come before graph in DOM
      const promptEl = container.querySelector('[data-testid="prompt-renderer"]')
      const graphEl = container.querySelector('[data-testid="graph-child"]')
      expect(promptEl?.compareDocumentPosition(graphEl!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    })
  })

  describe('textBelow layout', () => {
    it('renders graph above prompt with flex-col', () => {
      const { container } = renderWithGraph('textBelow')
      const wrapper = container.firstChild as HTMLElement

      // Should have flex-col class
      expect(wrapper.className).toContain('flex-col')
      // Graph should come before prompt in DOM
      const promptEl = container.querySelector('[data-testid="prompt-renderer"]')
      const graphEl = container.querySelector('[data-testid="graph-child"]')
      expect(graphEl?.compareDocumentPosition(promptEl!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    })
  })

  describe('textLeft layout', () => {
    it('renders prompt left of graph with flex-row', () => {
      const { container } = renderWithGraph('textLeft')
      const wrapper = container.firstChild as HTMLElement

      // Should have flex-row class (NOT flex-col)
      expect(wrapper.className).toContain('flex-row')
      expect(wrapper.className).not.toContain('flex-col')
      // Prompt should come before graph in DOM (left side)
      const promptEl = container.querySelector('[data-testid="prompt-renderer"]')
      const graphEl = container.querySelector('[data-testid="graph-child"]')
      expect(promptEl?.compareDocumentPosition(graphEl!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    })

    it('does not use responsive breakpoint classes for strict mobile', () => {
      const { container } = renderWithGraph('textLeft')
      const wrapper = container.firstChild as HTMLElement

      // Should NOT have md:, lg:, or sm: prefixed flex-direction classes
      expect(wrapper.className).not.toMatch(/md:flex/)
      expect(wrapper.className).not.toMatch(/lg:flex/)
      expect(wrapper.className).not.toMatch(/sm:flex/)
    })
  })

  describe('textRight layout', () => {
    it('renders graph left of prompt with flex-row', () => {
      const { container } = renderWithGraph('textRight')
      const wrapper = container.firstChild as HTMLElement

      // Should have flex-row class (NOT flex-col)
      expect(wrapper.className).toContain('flex-row')
      expect(wrapper.className).not.toContain('flex-col')
      // Graph should come before prompt in DOM (left side)
      const promptEl = container.querySelector('[data-testid="prompt-renderer"]')
      const graphEl = container.querySelector('[data-testid="graph-child"]')
      expect(graphEl?.compareDocumentPosition(promptEl!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    })

    it('does not use responsive breakpoint classes for strict mobile', () => {
      const { container } = renderWithGraph('textRight')
      const wrapper = container.firstChild as HTMLElement

      // Should NOT have md:, lg:, or sm: prefixed flex-direction classes
      expect(wrapper.className).not.toMatch(/md:flex/)
      expect(wrapper.className).not.toMatch(/lg:flex/)
      expect(wrapper.className).not.toMatch(/sm:flex/)
    })
  })

  describe('default layout', () => {
    it('defaults to textRight (flex-row) when no layout provided', () => {
      const { container } = render(
        <GraphWithPrompt blockId="test-block" prompt={mockPrompt}>
          <div data-testid="graph-child">Graph Content</div>
        </GraphWithPrompt>,
      )
      const wrapper = container.firstChild as HTMLElement

      // Should default to flex-row (textRight)
      expect(wrapper.className).toContain('flex-row')
    })
  })

  describe('minimum width threshold', () => {
    it('applies minimum width to graph container for side-by-side layouts', () => {
      const { container: containerLeft } = renderWithGraph('textLeft')
      const graphContainerLeft = containerLeft.querySelector('[data-testid="graph-child"]')

      // For textLeft, the graph should be in a container with min-width
      expect(graphContainerLeft?.className).toMatch(/min-w-/)

      const { container: containerRight } = renderWithGraph('textRight')
      const graphContainerRight = containerRight.querySelector('[data-testid="graph-child"]')

      // For textRight, the graph should be in a container with min-width
      expect(graphContainerRight?.className).toMatch(/min-w-/)
    })

    it('does not apply minimum width threshold for vertical layouts', () => {
      const { container: containerAbove } = renderWithGraph('textAbove')
      const graphContainerAbove = containerAbove.querySelector('[data-testid="graph-child"]')

      // Vertical layouts should not need minimum width constraint
      expect(graphContainerAbove?.className).not.toMatch(/min-w-/)
    })
  })

  describe('spacing', () => {
    it('applies gap between prompt and graph', () => {
      const { container } = renderWithGraph('textRight')
      const wrapper = container.firstChild as HTMLElement

      // Should have gap class
      expect(wrapper.className).toMatch(/gap-/)
    })
  })

  describe('prose styling for prompt', () => {
    it('renders prompt with prose styling classes', () => {
      const { container } = renderWithGraph('textRight')
      const promptWrapper = container.querySelector(
        '[data-testid="prompt-wrapper"]',
      )?.firstElementChild

      // Should have prose classes for consistent typography
      expect(promptWrapper?.className).toContain('prose')
    })
  })
})

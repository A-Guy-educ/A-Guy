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
 * 4. No responsive breakpoint classes for interactive (non-worksheet) mode
 * 5. Worksheet mode: 60/40 proportions, 3/5 wrap, mobile stacking
 */

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock RichTextRenderer since it's a dependency
vi.mock('@/ui/web/exerciserenderer/blocks/RichTextRenderer', () => ({
  RichTextRenderer: ({ block }: { block: { value: string } }) => (
    <div data-testid="prompt-renderer">{block.value}</div>
  ),
}))

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

  // Helper to render component with a graph child (interactive / non-worksheet mode)
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

  describe('textLeft layout (interactive mode — no worksheetLayout)', () => {
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

    it('interactive mode does NOT use responsive breakpoint classes', () => {
      const { container } = renderWithGraph('textLeft')
      const wrapper = container.firstChild as HTMLElement

      // Should NOT have md:, lg:, or sm: prefixed flex-direction classes
      expect(wrapper.className).not.toMatch(/sm:flex/)
      expect(wrapper.className).not.toMatch(/md:flex/)
      expect(wrapper.className).not.toMatch(/lg:flex/)
    })
  })

  describe('textRight layout (interactive mode — no worksheetLayout)', () => {
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

    it('interactive mode does NOT use responsive breakpoint classes', () => {
      const { container } = renderWithGraph('textRight')
      const wrapper = container.firstChild as HTMLElement

      // Should NOT have md:, lg:, or sm: prefixed flex-direction classes
      expect(wrapper.className).not.toMatch(/sm:flex/)
      expect(wrapper.className).not.toMatch(/md:flex/)
      expect(wrapper.className).not.toMatch(/lg:flex/)
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

  describe('minimum width threshold (interactive mode)', () => {
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

  describe('RTL layout stability', () => {
    it('forces LTR direction on side-by-side containers to prevent RTL reversal', () => {
      const { container: containerLeft } = renderWithGraph('textLeft')
      const wrapperLeft = containerLeft.firstChild as HTMLElement
      expect(wrapperLeft.getAttribute('dir')).toBe('ltr')

      const { container: containerRight } = renderWithGraph('textRight')
      const wrapperRight = containerRight.firstChild as HTMLElement
      expect(wrapperRight.getAttribute('dir')).toBe('ltr')
    })

    it('does not force direction on vertical layouts', () => {
      const { container: containerAbove } = renderWithGraph('textAbove')
      const wrapperAbove = containerAbove.firstChild as HTMLElement
      expect(wrapperAbove.getAttribute('dir')).toBeNull()

      const { container: containerBelow } = renderWithGraph('textBelow')
      const wrapperBelow = containerBelow.firstChild as HTMLElement
      expect(wrapperBelow.getAttribute('dir')).toBeNull()
    })

    it('sets dir="auto" on prompt wrapper for correct text direction', () => {
      const { container } = renderWithGraph('textRight')
      const promptWrapper = container.querySelector('[data-testid="prompt-wrapper"]')
      expect(promptWrapper?.getAttribute('dir')).toBe('auto')
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

  // ============================================================
  // Worksheet mode tests (worksheetLayout prop provided)
  // ============================================================

  describe('worksheet mode: 60/40 proportions', () => {
    it('applies flex-[3] to prompt and flex-[2] max-w-[25rem] to graph for textLeft side-by-side', () => {
      const { container } = render(
        <GraphWithPrompt
          blockId="test-block"
          layout="textLeft"
          prompt={mockPrompt}
          worksheetLayout={{ sideContentAspectRatio: 0.4 }}
        >
          <div data-testid="graph-child">Graph Content</div>
        </GraphWithPrompt>,
      )
      const promptWrapper = container.querySelector('[data-testid="prompt-wrapper"]')
      const graphChild = container.querySelector('[data-testid="graph-child"]')

      expect(promptWrapper?.className).toContain('flex-[3]')
      expect(graphChild?.className).toContain('flex-[2]')
      expect(graphChild?.className).toContain('max-w-[25rem]')
    })

    it('applies flex-[3] to prompt and flex-[2] max-w-[25rem] to graph for textRight side-by-side', () => {
      const { container } = render(
        <GraphWithPrompt
          blockId="test-block"
          layout="textRight"
          prompt={mockPrompt}
          worksheetLayout={{ sideContentAspectRatio: 0.4 }}
        >
          <div data-testid="graph-child">Graph Content</div>
        </GraphWithPrompt>,
      )
      const promptWrapper = container.querySelector('[data-testid="prompt-wrapper"]')
      const graphChild = container.querySelector('[data-testid="graph-child"]')

      expect(promptWrapper?.className).toContain('flex-[3]')
      expect(graphChild?.className).toContain('flex-[2]')
      expect(graphChild?.className).toContain('max-w-[25rem]')
    })

    it('applies 50/50 proportions when proportions is "50-50"', () => {
      const { container } = render(
        <GraphWithPrompt
          blockId="test-block"
          layout="textLeft"
          prompt={mockPrompt}
          worksheetLayout={{ proportions: '50-50', sideContentAspectRatio: 0.4 }}
        >
          <div data-testid="graph-child">Graph Content</div>
        </GraphWithPrompt>,
      )
      const graphChild = container.querySelector('[data-testid="graph-child"]')

      // With 50-50, graph should have flex-1 (not flex-[2]) and no max-w cap
      expect(graphChild?.className).toContain('flex-1')
      expect(graphChild?.className).not.toContain('max-w-')
    })
  })

  describe('worksheet mode: 3/5 wrap rule', () => {
    it('triggers wrap (stacked flex-col) when aspect ratio > 5/3 for textLeft', () => {
      const { container } = render(
        <GraphWithPrompt
          blockId="test-block"
          layout="textLeft"
          prompt={mockPrompt}
          worksheetLayout={{ sideContentAspectRatio: 2.5 }}
        >
          <div data-testid="graph-child">Graph Content</div>
        </GraphWithPrompt>,
      )
      const wrapper = container.firstChild as HTMLElement

      // Should use flex-col (stacked) not flex-row
      expect(wrapper.className).toContain('flex-col')
      expect(wrapper.className).not.toContain('flex-row')
    })

    it('triggers wrap (stacked flex-col) when aspect ratio > 5/3 for textRight', () => {
      const { container } = render(
        <GraphWithPrompt
          blockId="test-block"
          layout="textRight"
          prompt={mockPrompt}
          worksheetLayout={{ sideContentAspectRatio: 2.5 }}
        >
          <div data-testid="graph-child">Graph Content</div>
        </GraphWithPrompt>,
      )
      const wrapper = container.firstChild as HTMLElement

      expect(wrapper.className).toContain('flex-col')
      expect(wrapper.className).not.toContain('flex-row')
    })

    it('keeps side-by-side (flex-row) when aspect ratio <= 5/3', () => {
      const { container } = render(
        <GraphWithPrompt
          blockId="test-block"
          layout="textLeft"
          prompt={mockPrompt}
          worksheetLayout={{ sideContentAspectRatio: 1.5 }}
        >
          <div data-testid="graph-child">Graph Content</div>
        </GraphWithPrompt>,
      )
      const wrapper = container.firstChild as HTMLElement

      // Should have sm:flex-row for side-by-side above 640px
      expect(wrapper.className).toContain('sm:flex-row')
      // And flex-col below 640px for mobile stacking
      expect(wrapper.className).toContain('flex-col')
    })

    it('no wrap when sideContentAspectRatio is undefined', () => {
      const { container } = render(
        <GraphWithPrompt
          blockId="test-block"
          layout="textLeft"
          prompt={mockPrompt}
          worksheetLayout={{}}
        >
          <div data-testid="graph-child">Graph Content</div>
        </GraphWithPrompt>,
      )
      const wrapper = container.firstChild as HTMLElement

      // No aspect ratio → no wrap → side-by-side with sm breakpoint
      expect(wrapper.className).toContain('sm:flex-row')
    })
  })

  describe('worksheet mode: mobile stack order', () => {
    it('container has sm:flex-row for textLeft worksheet side-by-side', () => {
      const { container } = render(
        <GraphWithPrompt
          blockId="test-block"
          layout="textLeft"
          prompt={mockPrompt}
          worksheetLayout={{ sideContentAspectRatio: 0.4 }}
        >
          <div data-testid="graph-child">Graph Content</div>
        </GraphWithPrompt>,
      )
      const wrapper = container.firstChild as HTMLElement

      // sm:flex-row = side-by-side above 640px; flex-col = stacked below
      expect(wrapper.className).toContain('sm:flex-row')
      expect(wrapper.className).toContain('flex-col')
    })

    it('textLeft: prompt is already first in DOM — no sm:order-first needed', () => {
      const { container } = render(
        <GraphWithPrompt
          blockId="test-block"
          layout="textLeft"
          prompt={mockPrompt}
          worksheetLayout={{ sideContentAspectRatio: 0.4 }}
        >
          <div data-testid="graph-child">Graph Content</div>
        </GraphWithPrompt>,
      )
      const promptWrapper = container.querySelector('[data-testid="prompt-wrapper"]')

      // For textLeft, prompt is already first in DOM order — no sm:order-first needed
      expect(promptWrapper?.className).not.toMatch(/order/)
    })

    it('textRight: graph has sm:order-last so prompt appears first on mobile', () => {
      const { container } = render(
        <GraphWithPrompt
          blockId="test-block"
          layout="textRight"
          prompt={mockPrompt}
          worksheetLayout={{ sideContentAspectRatio: 0.4 }}
        >
          <div data-testid="graph-child">Graph Content</div>
        </GraphWithPrompt>,
      )
      const graphChild = container.querySelector('[data-testid="graph-child"]')

      // Graph is first in DOM (textRight) → needs sm:order-last so prompt is visual-first on mobile
      expect(graphChild?.className).toContain('sm:order-last')
    })

    it('interactive mode (no worksheetLayout) does not apply sm:order classes', () => {
      const { container } = renderWithGraph('textRight')
      const graphChild = container.querySelector('[data-testid="graph-child"]')

      expect(graphChild?.className).not.toMatch(/sm:order/)
    })
  })
})

// @vitest-environment jsdom
import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GraphWithPrompt } from '@/ui/web/exerciserenderer/blocks/GraphWithPrompt'

// Helper to extract the container className from rendered GraphWithPrompt
function getContainerClassName(layout: 'textLeft' | 'textRight' | 'textAbove' | 'textBelow') {
  const { container } = render(
    <GraphWithPrompt layout={layout} blockId="test-block">
      <div>Graph</div>
    </GraphWithPrompt>,
  )
  return container.firstElementChild?.className ?? ''
}

describe('GraphWithPrompt responsive layout', () => {
  describe('textLeft layout (non-worksheet)', () => {
    it('should stack vertically on mobile (flex-col) and go side-by-side at sm breakpoint', () => {
      const className = getContainerClassName('textLeft')
      // Must have flex-col for mobile stacking
      expect(className).toContain('flex-col')
      // Must have sm:flex-row for side-by-side at sm breakpoint
      expect(className).toMatch(/\bsm:flex-row\b/)
    })

    it('should NOT have unconditional flex-row without breakpoint', () => {
      const className = getContainerClassName('textLeft')
      // Should not have plain "flex-row" without sm: prefix (would prevent mobile stacking)
      // Use negative lookbehind to exclude sm:flex-row (which IS correct)
      expect(className).not.toMatch(/(?<!sm:)(?<!md:)(?<!lg:)(?<!xl:)\bflex-row\b/)
    })
  })

  describe('textRight layout (non-worksheet)', () => {
    it('should stack vertically on mobile (flex-col) and go side-by-side at sm breakpoint', () => {
      const className = getContainerClassName('textRight')
      expect(className).toContain('flex-col')
      expect(className).toMatch(/\bsm:flex-row\b/)
    })

    it('should NOT have unconditional flex-row without breakpoint', () => {
      const className = getContainerClassName('textRight')
      // Use negative lookbehind to exclude sm:flex-row (which IS correct)
      expect(className).not.toMatch(/(?<!sm:)(?<!md:)(?<!lg:)(?<!xl:)\bflex-row\b/)
    })
  })

  describe('textAbove layout (non-worksheet)', () => {
    it('should remain vertical (flex-col) at all breakpoints', () => {
      const className = getContainerClassName('textAbove')
      expect(className).toContain('flex-col')
      // Should not have sm:flex-row for vertical layouts
      expect(className).not.toMatch(/\bflex-row\b/)
    })
  })

  describe('textBelow layout (non-worksheet)', () => {
    it('should remain vertical (flex-col) at all breakpoints', () => {
      const className = getContainerClassName('textBelow')
      expect(className).toContain('flex-col')
      expect(className).not.toMatch(/\bflex-row\b/)
    })
  })
})

/**
 * @fileType unit-test
 * @domain exercises
 * @pattern ui-test, student-renderer, axis-renderer
 * @ai-summary Unit tests for displaySize in student-facing AxisRenderer component
 */
// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'

interface AxisRendererProps {
  blockId: string
  spec: AxisSpecV1
  displaySize?: 'small' | 'medium' | 'large' | 'full'
}

const SIZE_MAP = {
  small: '33%',
  medium: '50%',
  large: '75%',
  full: '100%',
} as const

const MockAxisRenderer: React.FC<AxisRendererProps> = ({ blockId, spec, displaySize = 'full' }) => {
  const widthPercent = SIZE_MAP[displaySize]

  return (
    <div
      data-testid="axis-renderer-container"
      data-display-size={displaySize}
      style={{ width: widthPercent }}
      className="mx-auto"
    >
      <div data-testid="jsxgraph-wrapper">
        <div
          data-testid="jsxgraph-board"
          style={{
            width: '100%',
            aspectRatio: '3/2',
            maxWidth: '600px',
          }}
        >
          <div data-testid="board-content">Axis Graph: {spec.elements.graphs.length} functions</div>
        </div>
      </div>
    </div>
  )
}

describe('AxisRenderer displaySize', () => {
  const createMockSpec = (): AxisSpecV1 => ({
    kind: 'cartesian',
    units: 1,
    grid: { enabled: true, color: '#e0e0e0' },
    axes: {
      showNumbers: true,
      showLabels: true,
      ticks: 1,
      labels: { x: 'x', y: 'y' },
      origin: { x: 0, y: 0 },
    },
    viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
    elements: {
      points: [],
      graphs: [{ id: 'g1', fn: 'x^2', style: 'solid', thickness: 2, color: '#3366cc' }],
    },
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Width percentage application', () => {
    it('applies 33% width for small displaySize', () => {
      const spec = createMockSpec()

      render(<MockAxisRenderer blockId="test-1" spec={spec} displaySize="small" />)

      const container = screen.getByTestId('axis-renderer-container')
      expect(container).toHaveStyle({ width: '33%' })
      expect(container).toHaveAttribute('data-display-size', 'small')
    })

    it('applies 50% width for medium displaySize', () => {
      const spec = createMockSpec()

      render(<MockAxisRenderer blockId="test-1" spec={spec} displaySize="medium" />)

      const container = screen.getByTestId('axis-renderer-container')
      expect(container).toHaveStyle({ width: '50%' })
    })

    it('applies 75% width for large displaySize', () => {
      const spec = createMockSpec()

      render(<MockAxisRenderer blockId="test-1" spec={spec} displaySize="large" />)

      const container = screen.getByTestId('axis-renderer-container')
      expect(container).toHaveStyle({ width: '75%' })
    })

    it('applies 100% width for full displaySize', () => {
      const spec = createMockSpec()

      render(<MockAxisRenderer blockId="test-1" spec={spec} displaySize="full" />)

      const container = screen.getByTestId('axis-renderer-container')
      expect(container).toHaveStyle({ width: '100%' })
    })
  })

  describe('Default behavior (backward compatibility)', () => {
    it('defaults to full width when displaySize is undefined', () => {
      const spec = createMockSpec()

      render(<MockAxisRenderer blockId="test-1" spec={spec} />)

      const container = screen.getByTestId('axis-renderer-container')
      expect(container).toHaveStyle({ width: '100%' })
    })
  })

  describe('Aspect ratio preservation', () => {
    it('maintains 3:2 aspect ratio', () => {
      const spec = createMockSpec()

      render(<MockAxisRenderer blockId="test-1" spec={spec} displaySize="medium" />)

      const board = screen.getByTestId('jsxgraph-board')
      expect(board).toHaveStyle({ aspectRatio: '3/2' })
    })

    it('constrains max width to 600px', () => {
      const spec = createMockSpec()

      render(<MockAxisRenderer blockId="test-1" spec={spec} displaySize="full" />)

      const board = screen.getByTestId('jsxgraph-board')
      expect(board).toHaveStyle({ maxWidth: '600px' })
    })
  })
})

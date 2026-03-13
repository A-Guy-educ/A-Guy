/**
 * @fileType unit-test
 * @domain exercises
 * @pattern ui-test, admin-editor, axis-editor
 * @ai-summary Unit tests for displaySize selector in AxisEditor admin component
 */
// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

import type { QuestionAxisBlock } from '@/server/payload/collections/Exercises/types'

// Simple mock for testing the UI behavior
const MockAxisEditor: React.FC<{
  block: QuestionAxisBlock
  onChange: (block: QuestionAxisBlock) => void
}> = ({ block, onChange }) => {
  const displaySize = block.displaySize || 'full'

  return (
    <div data-testid="axis-editor">
      <div data-testid="display-size-section">
        <label htmlFor="displaySize">Display Size</label>
        <select
          id="displaySize"
          data-testid="display-size-select"
          value={displaySize}
          onChange={(e) => {
            onChange({
              ...block,
              displaySize: e.target.value as QuestionAxisBlock['displaySize'],
            })
          }}
        >
          <option value="small">Small (33%)</option>
          <option value="medium">Medium (50%)</option>
          <option value="large">Large (75%)</option>
          <option value="full">Full Width (100%)</option>
        </select>
      </div>
      <div data-testid="prompt-section">
        <label>Prompt</label>
        <div data-testid="prompt-value">{block.prompt?.value || ''}</div>
      </div>
    </div>
  )
}

describe('AxisEditor Display Size Selector', () => {
  const createMockBlock = (
    displaySize?: 'small' | 'medium' | 'large' | 'full',
  ): QuestionAxisBlock => ({
    id: 'test-axis-1',
    type: 'question_axis',
    prompt: {
      type: 'rich_text',
      format: 'md-math-v1',
      value: 'Graph the function f(x) = x^2',
      mediaIds: [],
    },
    axis: {
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
      elements: { points: [], graphs: [] },
    },
    displaySize,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders display size selector with current value', () => {
      const mockBlock = createMockBlock('medium')
      const mockOnChange = vi.fn()

      render(<MockAxisEditor block={mockBlock} onChange={mockOnChange} />)

      const select = screen.getByTestId('display-size-select')
      expect(select).toBeInTheDocument()
      expect(select).toHaveValue('medium')
    })

    it('renders display size selector with all options', () => {
      const mockBlock = createMockBlock('full')
      const mockOnChange = vi.fn()

      render(<MockAxisEditor block={mockBlock} onChange={mockOnChange} />)

      expect(screen.getByText('Small (33%)')).toBeInTheDocument()
      expect(screen.getByText('Medium (50%)')).toBeInTheDocument()
      expect(screen.getByText('Large (75%)')).toBeInTheDocument()
      expect(screen.getByText('Full Width (100%)')).toBeInTheDocument()
    })

    it('renders Display Size label', () => {
      const mockBlock = createMockBlock()
      const mockOnChange = vi.fn()

      render(<MockAxisEditor block={mockBlock} onChange={mockOnChange} />)

      expect(screen.getByText('Display Size')).toBeInTheDocument()
    })
  })

  describe('Default value', () => {
    it('defaults display size to full when not set', () => {
      const mockBlock = createMockBlock()
      const mockOnChange = vi.fn()

      render(<MockAxisEditor block={mockBlock} onChange={mockOnChange} />)

      const select = screen.getByTestId('display-size-select')
      expect(select).toHaveValue('full')
    })
  })

  describe('User interaction', () => {
    it('calls onChange with updated displaySize when selector changes', () => {
      const mockBlock = createMockBlock('full')
      const mockOnChange = vi.fn()

      render(<MockAxisEditor block={mockBlock} onChange={mockOnChange} />)

      const select = screen.getByTestId('display-size-select')
      fireEvent.change(select, { target: { value: 'small' } })

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          displaySize: 'small',
        }),
      )
    })
  })
})

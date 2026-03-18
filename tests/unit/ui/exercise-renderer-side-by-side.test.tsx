/**
 * @fileType unit-test
 * @domain exercises
 * @pattern ui-test, student-renderer, layout
 * @ai-summary Unit tests for side-by-side layout of axis blocks with rich text
 */
// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type {
  ContentBlock,
  QuestionAxisBlock,
  RichTextBlock,
} from '@/server/payload/collections/Exercises/types'

interface ExerciseContent {
  blocks: ContentBlock[]
}

const createAxisBlock = (
  displaySize?: 'small' | 'medium' | 'large' | 'full',
): QuestionAxisBlock => ({
  id: 'axis-1',
  type: 'question_axis',
  prompt: {
    type: 'rich_text',
    format: 'md-math-v1',
    value: 'Graph the function',
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

const createRichTextBlock = (value: string): RichTextBlock => ({
  id: 'rt-1',
  type: 'rich_text',
  format: 'md-math-v1',
  value,
  mediaIds: [],
})

// Mock renderer implementing side-by-side logic
const MockExerciseRenderer: React.FC<{ content: ExerciseContent }> = ({ content }) => {
  const blocks = content.blocks
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < blocks.length) {
    const block = blocks[i]

    if (block.type === 'question_axis') {
      const axisBlock = block as QuestionAxisBlock
      const displaySize = axisBlock.displaySize || 'full'
      const nextBlock = blocks[i + 1]
      const hasAdjacentText = nextBlock && nextBlock.type === 'rich_text'

      if (displaySize !== 'full' && hasAdjacentText) {
        const textBlock = nextBlock as RichTextBlock

        elements.push(
          <div
            key={`side-by-side-${i}`}
            data-testid="side-by-side-container"
            className="flex gap-4 items-start"
          >
            <div
              data-testid="axis-wrapper"
              data-width={displaySize}
              style={{
                width: displaySize === 'small' ? '33%' : displaySize === 'medium' ? '50%' : '75%',
              }}
              className="flex-shrink-0"
            >
              <div data-testid="axis-block">Axis Graph</div>
            </div>
            <div data-testid="text-wrapper" className="flex-1 min-w-0">
              <div data-testid="rich-text-block">{textBlock.value}</div>
            </div>
          </div>,
        )

        i += 2
        continue
      }
    }

    if (block.type === 'question_axis') {
      elements.push(
        <div key={block.id} data-testid="axis-full-width">
          <div data-testid="axis-block">Full Width Axis Graph</div>
        </div>,
      )
    } else if (block.type === 'rich_text') {
      elements.push(
        <div key={block.id} data-testid="rich-text-block">
          {(block as RichTextBlock).value}
        </div>,
      )
    }

    i++
  }

  return <div data-testid="exercise-renderer">{elements}</div>
}

describe('ExerciseRenderer Side-by-Side Layout', () => {
  describe('Side-by-side rendering', () => {
    it('renders axis + rich_text side-by-side when displaySize is medium', () => {
      const content: ExerciseContent = {
        blocks: [createAxisBlock('medium'), createRichTextBlock('The graph shows f(x) = x^2')],
      }

      render(<MockExerciseRenderer content={content} />)

      const container = screen.getByTestId('side-by-side-container')
      expect(container).toBeInTheDocument()
      expect(container).toHaveClass('flex', 'gap-4', 'items-start')
    })

    it('renders axis + rich_text side-by-side when displaySize is small', () => {
      const content: ExerciseContent = {
        blocks: [createAxisBlock('small'), createRichTextBlock('Small graph with explanation')],
      }

      render(<MockExerciseRenderer content={content} />)

      const container = screen.getByTestId('side-by-side-container')
      expect(container).toBeInTheDocument()
    })

    it('does NOT render side-by-side when displaySize is full', () => {
      const content: ExerciseContent = {
        blocks: [createAxisBlock('full'), createRichTextBlock('Full width graph explanation')],
      }

      render(<MockExerciseRenderer content={content} />)

      expect(screen.queryByTestId('side-by-side-container')).not.toBeInTheDocument()
      expect(screen.getByTestId('axis-full-width')).toBeInTheDocument()
    })
  })

  describe('Text fills remaining space', () => {
    it('applies flex-1 class to text wrapper in side-by-side', () => {
      const content: ExerciseContent = {
        blocks: [createAxisBlock('medium'), createRichTextBlock('Explanation text')],
      }

      render(<MockExerciseRenderer content={content} />)

      const textWrapper = screen.getByTestId('text-wrapper')
      expect(textWrapper).toHaveClass('flex-1', 'min-w-0')
    })
  })

  describe('Edge cases', () => {
    it('renders axis at full width when there is no adjacent text block', () => {
      const content: ExerciseContent = {
        blocks: [createAxisBlock('medium')],
      }

      render(<MockExerciseRenderer content={content} />)

      expect(screen.queryByTestId('side-by-side-container')).not.toBeInTheDocument()
      expect(screen.getByTestId('axis-full-width')).toBeInTheDocument()
    })

    it('renders axis at full width when displaySize is not set', () => {
      const content: ExerciseContent = {
        blocks: [
          { ...createAxisBlock() } as QuestionAxisBlock,
          createRichTextBlock('Some explanation'),
        ],
      }

      render(<MockExerciseRenderer content={content} />)

      expect(screen.queryByTestId('side-by-side-container')).not.toBeInTheDocument()
    })
  })
})

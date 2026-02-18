// @vitest-environment jsdom
import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer/ExerciseRenderer'
import type {
  ExerciseContentData,
  QuestionSelectMcqBlock,
  QuestionFreeResponseBlock,
  RichTextBlock,
} from '@/ui/web/exerciserenderer/types'

// Mock the I18n hooks
const mockUseLocale = vi.fn(() => 'en')
const mockUseTranslations = vi.fn(() => (key: string) => key)

vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations: () => mockUseTranslations(),
  useLocale: () => mockUseLocale(),
}))

vi.mock('@/i18n/config', () => ({
  getDirection: (locale: string) => (locale === 'he' ? 'rtl' : 'ltr'),
}))

function createMcqQuestion(id: string): QuestionSelectMcqBlock {
  return {
    id,
    type: 'question_select',
    variant: 'mcq',
    selectionMode: 'single',
    prompt: {
      type: 'rich_text',
      format: 'md-math-v1',
      value: `Question ${id}`,
    },
    answer: {
      multiSelect: false,
      options: [
        {
          id: 'opt1',
          content: {
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'Option 1',
          },
        },
      ],
      correctOptionIds: ['opt1'],
    },
  }
}

function createFreeResponseQuestion(id: string): QuestionFreeResponseBlock {
  return {
    id,
    type: 'question_free_response',
    prompt: {
      type: 'rich_text',
      format: 'md-math-v1',
      value: `Question ${id}`,
    },
    answer: {
      acceptedAnswers: ['answer'],
    },
  }
}

function createRichTextBlock(id: string, value: string): RichTextBlock {
  return {
    id,
    type: 'rich_text',
    format: 'md-math-v1',
    value,
  }
}

describe('Question Numbering', () => {
  describe('English locale (LTR)', () => {
    it('numbers questions sequentially with A.1, A.2, A.3', () => {
      const content: ExerciseContentData = {
        blocks: [
          createMcqQuestion('q1'),
          createMcqQuestion('q2'),
          createFreeResponseQuestion('q3'),
        ],
      }

      const { container } = render(<ExerciseRenderer content={content} showCheckAnswer={false} />)

      // Find all question labels
      const labels = container.querySelectorAll('.font-semibold.text-sm.text-muted-foreground')
      expect(labels).toHaveLength(3)
      expect(labels[0].textContent).toBe('A.1')
      expect(labels[1].textContent).toBe('A.2')
      expect(labels[2].textContent).toBe('A.3')
    })

    it('shows bubble only on the first question', () => {
      const content: ExerciseContentData = {
        blocks: [createMcqQuestion('q1'), createMcqQuestion('q2'), createMcqQuestion('q3')],
      }

      const { container } = render(<ExerciseRenderer content={content} showCheckAnswer={false} />)

      // Find all bubbles
      const bubbles = container.querySelectorAll('.w-7.h-7.rounded-full')
      expect(bubbles).toHaveLength(1)
      expect(bubbles[0].textContent).toBe('A')
    })

    it('excludes rich text blocks from numbering', () => {
      const content: ExerciseContentData = {
        blocks: [
          createMcqQuestion('q1'),
          createRichTextBlock('rt1', 'Some rich text'),
          createMcqQuestion('q2'),
          createRichTextBlock('rt2', 'More rich text'),
          createFreeResponseQuestion('q3'),
        ],
      }

      const { container } = render(<ExerciseRenderer content={content} showCheckAnswer={false} />)

      // Find all question labels (should only be 3, not 5)
      const labels = container.querySelectorAll('.font-semibold.text-sm.text-muted-foreground')
      expect(labels).toHaveLength(3)
      expect(labels[0].textContent).toBe('A.1')
      expect(labels[1].textContent).toBe('A.2')
      expect(labels[2].textContent).toBe('A.3')
    })

    it('positions bubble on the left in LTR mode', () => {
      const content: ExerciseContentData = {
        blocks: [createMcqQuestion('q1')],
      }

      const { container } = render(<ExerciseRenderer content={content} showCheckAnswer={false} />)

      // Find the label container
      const labelContainer = container.querySelector('.flex.items-center.gap-2')
      expect(labelContainer).toBeTruthy()
      // Should not have flex-row-reverse class
      expect(labelContainer?.classList.contains('flex-row-reverse')).toBe(false)
    })
  })

  describe('Hebrew locale (RTL)', () => {
    beforeEach(() => {
      mockUseLocale.mockReturnValue('he')
    })

    afterEach(() => {
      mockUseLocale.mockReturnValue('en')
    })

    it('numbers questions with Hebrew section label א.1, א.2, א.3', () => {
      const content: ExerciseContentData = {
        blocks: [
          createMcqQuestion('q1'),
          createMcqQuestion('q2'),
          createFreeResponseQuestion('q3'),
        ],
      }

      const { container } = render(<ExerciseRenderer content={content} showCheckAnswer={false} />)

      // Find all question labels
      const labels = container.querySelectorAll('.font-semibold.text-sm.text-muted-foreground')
      expect(labels).toHaveLength(3)
      expect(labels[0].textContent).toBe('א.1')
      expect(labels[1].textContent).toBe('א.2')
      expect(labels[2].textContent).toBe('א.3')
    })

    it('shows bubble with Hebrew letter א only on first question', () => {
      const content: ExerciseContentData = {
        blocks: [createMcqQuestion('q1'), createMcqQuestion('q2')],
      }

      const { container } = render(<ExerciseRenderer content={content} showCheckAnswer={false} />)

      // Find all bubbles
      const bubbles = container.querySelectorAll('.w-7.h-7.rounded-full')
      expect(bubbles).toHaveLength(1)
      expect(bubbles[0].textContent).toBe('א')
    })

    it('positions bubble on the right in RTL mode', () => {
      const content: ExerciseContentData = {
        blocks: [createMcqQuestion('q1')],
      }

      const { container } = render(<ExerciseRenderer content={content} showCheckAnswer={false} />)

      // Find the label container
      const labelContainer = container.querySelector('.flex.items-center.gap-2')
      expect(labelContainer).toBeTruthy()
      // Should have flex-row-reverse class for RTL
      expect(labelContainer?.classList.contains('flex-row-reverse')).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('handles empty blocks array', () => {
      const content: ExerciseContentData = {
        blocks: [],
      }

      const { container } = render(<ExerciseRenderer content={content} showCheckAnswer={false} />)
      expect(container.querySelector('.font-semibold.text-sm.text-muted-foreground')).toBeNull()
    })

    it('handles only rich text blocks (no questions)', () => {
      const content: ExerciseContentData = {
        blocks: [
          createRichTextBlock('rt1', 'Text 1'),
          createRichTextBlock('rt2', 'Text 2'),
          createRichTextBlock('rt3', 'Text 3'),
        ],
      }

      const { container } = render(<ExerciseRenderer content={content} showCheckAnswer={false} />)
      expect(container.querySelector('.font-semibold.text-sm.text-muted-foreground')).toBeNull()
    })

    it('handles single question', () => {
      const content: ExerciseContentData = {
        blocks: [createMcqQuestion('q1')],
      }

      const { container } = render(<ExerciseRenderer content={content} showCheckAnswer={false} />)

      const labels = container.querySelectorAll('.font-semibold.text-sm.text-muted-foreground')
      expect(labels).toHaveLength(1)
      expect(labels[0].textContent).toBe('A.1')

      const bubbles = container.querySelectorAll('.w-7.h-7.rounded-full')
      expect(bubbles).toHaveLength(1)
    })
  })

  describe('Bubble styling', () => {
    it('applies correct Tailwind classes to bubble', () => {
      const content: ExerciseContentData = {
        blocks: [createMcqQuestion('q1')],
      }

      const { container } = render(<ExerciseRenderer content={content} showCheckAnswer={false} />)

      const bubble = container.querySelector('.w-7.h-7.rounded-full')
      expect(bubble).toBeTruthy()
      expect(bubble?.classList.contains('flex')).toBe(true)
      expect(bubble?.classList.contains('items-center')).toBe(true)
      expect(bubble?.classList.contains('justify-center')).toBe(true)
      expect(bubble?.classList.contains('bg-slate-50')).toBe(true)
      expect(bubble?.classList.contains('border')).toBe(true)
      expect(bubble?.classList.contains('border-slate-200')).toBe(true)
      expect(bubble?.classList.contains('shadow-sm')).toBe(true)
    })
  })
})

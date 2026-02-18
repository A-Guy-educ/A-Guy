// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer/ExerciseRenderer'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'
import { I18nProvider } from '@/ui/web/providers/I18n'

// Mock translations
const mockMessages = {
  courses: {
    checkAnswer: 'Check Answer',
    correct: 'Correct',
    incorrect: 'Incorrect',
    invalidAnswerType: 'Invalid answer type',
    selectTrueFalse: 'Select true or false',
    noCorrectAnswer: 'No correct answer',
    selectAnAnswer: 'Select an answer',
    enterAnAnswer: 'Enter an answer',
    unknownVariant: 'Unknown variant',
    validationFailed: 'Validation failed',
    validationError: 'Validation error',
    connectionError: 'Connection error',
  },
}

function renderWithI18n(ui: React.ReactElement, locale: string = 'en') {
  return render(<I18nProvider locale={locale} messages={mockMessages}>{ui}</I18nProvider>)
}

describe('Exercise Question Numbering', () => {
  describe('English locale (A.1, A.2...)', () => {
    it('should render section label A with subquestion numbers', () => {
      const content: ExerciseContentData = {
        blocks: [
          {
            id: 'q1',
            type: 'question_select',
            variant: 'true_false',
            selectionMode: 'single',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'First question',
            },
            answer: { correctOptionId: 'true' },
          },
          {
            id: 'q2',
            type: 'question_free_response',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Second question',
            },
            answer: { acceptedAnswers: ['answer'] },
          },
          {
            id: 'q3',
            type: 'question_select',
            variant: 'mcq',
            selectionMode: 'single',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Third question',
            },
            answer: {
              multiSelect: false,
              options: [{ id: 'opt1', content: { type: 'rich_text', format: 'md-math-v1', value: 'Option 1' } }],
              correctOptionIds: ['opt1'],
            },
          },
        ],
      }

      const { container } = renderWithI18n(<ExerciseRenderer content={content} />, 'en')

      // Check for A.1, A.2, A.3 labels
      expect(container.textContent).toContain('A.1')
      expect(container.textContent).toContain('A.2')
      expect(container.textContent).toContain('A.3')
    })

    it('should show bubble with letter A only on first question', () => {
      const content: ExerciseContentData = {
        blocks: [
          {
            id: 'q1',
            type: 'question_select',
            variant: 'true_false',
            selectionMode: 'single',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'First question',
            },
            answer: { correctOptionId: 'true' },
          },
          {
            id: 'q2',
            type: 'question_free_response',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Second question',
            },
            answer: { acceptedAnswers: ['answer'] },
          },
        ],
      }

      const { container } = renderWithI18n(<ExerciseRenderer content={content} />, 'en')

      // Find all bubbles (circular containers with w-7 h-7 rounded-full)
      const bubbles = container.querySelectorAll('.w-7.h-7.rounded-full')
      
      // Should have exactly one bubble
      expect(bubbles).toHaveLength(1)
      
      // Bubble should contain letter "A"
      expect(bubbles[0].textContent).toBe('A')
    })
  })

  describe('Hebrew locale (א.1, א.2...)', () => {
    it('should render section label א with subquestion numbers', () => {
      const content: ExerciseContentData = {
        blocks: [
          {
            id: 'q1',
            type: 'question_select',
            variant: 'true_false',
            selectionMode: 'single',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'First question',
            },
            answer: { correctOptionId: 'true' },
          },
          {
            id: 'q2',
            type: 'question_free_response',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Second question',
            },
            answer: { acceptedAnswers: ['answer'] },
          },
        ],
      }

      const { container } = renderWithI18n(<ExerciseRenderer content={content} />, 'he')

      // Check for א.1, א.2 labels
      expect(container.textContent).toContain('א.1')
      expect(container.textContent).toContain('א.2')
    })

    it('should show bubble with letter א only on first question', () => {
      const content: ExerciseContentData = {
        blocks: [
          {
            id: 'q1',
            type: 'question_select',
            variant: 'true_false',
            selectionMode: 'single',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'First question',
            },
            answer: { correctOptionId: 'true' },
          },
          {
            id: 'q2',
            type: 'question_free_response',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Second question',
            },
            answer: { acceptedAnswers: ['answer'] },
          },
        ],
      }

      const { container } = renderWithI18n(<ExerciseRenderer content={content} />, 'he')

      // Find all bubbles
      const bubbles = container.querySelectorAll('.w-7.h-7.rounded-full')
      
      // Should have exactly one bubble
      expect(bubbles).toHaveLength(1)
      
      // Bubble should contain Hebrew letter "א"
      expect(bubbles[0].textContent).toBe('א')
    })

    it('should use RTL layout (flex-row-reverse) for Hebrew', () => {
      const content: ExerciseContentData = {
        blocks: [
          {
            id: 'q1',
            type: 'question_select',
            variant: 'true_false',
            selectionMode: 'single',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'First question',
            },
            answer: { correctOptionId: 'true' },
          },
        ],
      }

      const { container } = renderWithI18n(<ExerciseRenderer content={content} />, 'he')

      // Find the label container
      const labelContainer = container.querySelector('.flex-row-reverse')
      expect(labelContainer).toBeTruthy()
      expect(labelContainer?.getAttribute('dir')).toBe('rtl')
    })
  })

  describe('Rich text blocks should not increment counter', () => {
    it('should skip rich_text blocks when numbering questions', () => {
      const content: ExerciseContentData = {
        blocks: [
          {
            id: 'rt1',
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'This is some introductory text',
          },
          {
            id: 'q1',
            type: 'question_select',
            variant: 'true_false',
            selectionMode: 'single',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'First question',
            },
            answer: { correctOptionId: 'true' },
          },
          {
            id: 'rt2',
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'Some explanation between questions',
          },
          {
            id: 'q2',
            type: 'question_free_response',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Second question',
            },
            answer: { acceptedAnswers: ['answer'] },
          },
        ],
      }

      const { container } = renderWithI18n(<ExerciseRenderer content={content} />, 'en')

      // Should have A.1 and A.2 despite rich text blocks
      expect(container.textContent).toContain('A.1')
      expect(container.textContent).toContain('A.2')
      
      // Should only have one bubble (on first question)
      const bubbles = container.querySelectorAll('.w-7.h-7.rounded-full')
      expect(bubbles).toHaveLength(1)
    })
  })

  describe('Table questions should not be numbered', () => {
    it('should not show numbering for question_table blocks', () => {
      const content: ExerciseContentData = {
        blocks: [
          {
            id: 'q1',
            type: 'question_select',
            variant: 'true_false',
            selectionMode: 'single',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'First question',
            },
            answer: { correctOptionId: 'true' },
          },
          {
            id: 'qt1',
            type: 'question_table',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Fill in the table',
            },
            table: {
              solutionFill: true,
              headers: ['X', 'Y'],
              rowsData: [['1', '2']],
              answers: { '0_0': 'answer' },
              showBorders: true,
              showHeader: true,
            },
          },
          {
            id: 'q2',
            type: 'question_free_response',
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Second question',
            },
            answer: { acceptedAnswers: ['answer'] },
          },
        ],
      }

      const { container } = renderWithI18n(<ExerciseRenderer content={content} />, 'en')

      // Should have A.1 and A.2 for non-table questions
      expect(container.textContent).toContain('A.1')
      expect(container.textContent).toContain('A.2')
      
      // Should not have A.3 since table is not numbered
      expect(container.textContent).not.toContain('A.3')
    })
  })
})

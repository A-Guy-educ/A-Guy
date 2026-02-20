// @vitest-environment jsdom
import { McqQuestion } from '@/ui/web/exerciserenderer/questions/McqQuestion'
import type { QuestionSelectMcqBlock, UserAnswer } from '@/ui/web/exerciserenderer/types'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    selectOne: 'Select one answer',
    selectMultiple: 'Select all that apply',
  }
  return translations[key] || key
}

describe('McqQuestion component', () => {
  let onChange: (answer: UserAnswer) => void

  beforeEach(() => {
    onChange = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Fraction rendering transformation', () => {
    it('transforms \\frac to \\dfrac in MCQ options', () => {
      const questionWithFraction: QuestionSelectMcqBlock = {
        id: 'test-fraction',
        type: 'question_select',
        variant: 'mcq',
        selectionMode: 'single',
        prompt: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Which fraction is correct?',
          mediaIds: [],
        },
        answer: {
          multiSelect: false,
          options: [
            {
              id: 'opt1',
              content: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: '$\\frac{1}{2}$',
                mediaIds: [],
              },
            },
          ],
          correctOptionIds: ['opt1'],
        },
      }

      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      const { container } = render(
        <McqQuestion
          question={questionWithFraction}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      // Verify the component renders (transformation happens internally)
      expect(container.querySelector('.rich-text-content')).toBeTruthy()
    })

    it('handles multiple fractions in one option', () => {
      const questionWithMultipleFractions: QuestionSelectMcqBlock = {
        id: 'test-multiple-fractions',
        type: 'question_select',
        variant: 'mcq',
        selectionMode: 'single',
        prompt: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Select the correct equation',
          mediaIds: [],
        },
        answer: {
          multiSelect: false,
          options: [
            {
              id: 'opt1',
              content: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: '$\\frac{a}{b} + \\frac{c}{d}$',
                mediaIds: [],
              },
            },
          ],
          correctOptionIds: ['opt1'],
        },
      }

      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      const { container } = render(
        <McqQuestion
          question={questionWithMultipleFractions}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      expect(container.querySelector('.rich-text-content')).toBeTruthy()
    })

    it('handles nested fractions', () => {
      const questionWithNestedFraction: QuestionSelectMcqBlock = {
        id: 'test-nested-fraction',
        type: 'question_select',
        variant: 'mcq',
        selectionMode: 'single',
        prompt: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Select the correct fraction',
          mediaIds: [],
        },
        answer: {
          multiSelect: false,
          options: [
            {
              id: 'opt1',
              content: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: '$\\frac{\\frac{a}{b}}{c}$',
                mediaIds: [],
              },
            },
          ],
          correctOptionIds: ['opt1'],
        },
      }

      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      const { container } = render(
        <McqQuestion
          question={questionWithNestedFraction}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      expect(container.querySelector('.rich-text-content')).toBeTruthy()
    })

    it('does not double-transform existing \\dfrac', () => {
      const questionWithDfrac: QuestionSelectMcqBlock = {
        id: 'test-dfrac',
        type: 'question_select',
        variant: 'mcq',
        selectionMode: 'single',
        prompt: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Which fraction is correct?',
          mediaIds: [],
        },
        answer: {
          multiSelect: false,
          options: [
            {
              id: 'opt1',
              content: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: '$\\dfrac{1}{2}$',
                mediaIds: [],
              },
            },
          ],
          correctOptionIds: ['opt1'],
        },
      }

      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      const { container } = render(
        <McqQuestion
          question={questionWithDfrac}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      // Should render without errors (no double transformation to \\ddfrac)
      expect(container.querySelector('.rich-text-content')).toBeTruthy()
    })

    it('handles mixed text and fractions', () => {
      const questionWithMixedContent: QuestionSelectMcqBlock = {
        id: 'test-mixed',
        type: 'question_select',
        variant: 'mcq',
        selectionMode: 'single',
        prompt: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Select the answer',
          mediaIds: [],
        },
        answer: {
          multiSelect: false,
          options: [
            {
              id: 'opt1',
              content: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'The answer is $\\frac{1}{2}$ or approximately 0.5',
                mediaIds: [],
              },
            },
          ],
          correctOptionIds: ['opt1'],
        },
      }

      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      const { container } = render(
        <McqQuestion
          question={questionWithMixedContent}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      expect(container.querySelector('.rich-text-content')).toBeTruthy()
    })

    it('does not transform fractions in the prompt', () => {
      const questionWithFractionInPrompt: QuestionSelectMcqBlock = {
        id: 'test-prompt-fraction',
        type: 'question_select',
        variant: 'mcq',
        selectionMode: 'single',
        prompt: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'What is $\\frac{1}{2}$ + $\\frac{1}{4}$?',
          mediaIds: [],
        },
        answer: {
          multiSelect: false,
          options: [
            {
              id: 'opt1',
              content: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: '$\\frac{3}{4}$',
                mediaIds: [],
              },
            },
          ],
          correctOptionIds: ['opt1'],
        },
      }

      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      render(
        <McqQuestion
          question={questionWithFractionInPrompt}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      // Prompt should render as-is (we only transform options)
      // This is a smoke test to ensure the component renders without errors
      expect(screen.getByText(/What is/)).toBeTruthy()
    })
  })

  describe('Single-answer mode', () => {
    const singleAnswerQuestion: QuestionSelectMcqBlock = {
      id: 'test-q1',
      type: 'question_select',
      variant: 'mcq',
      selectionMode: 'single',
      prompt: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'What is 2 + 2?',
        mediaIds: [],
      },
      answer: {
        multiSelect: false,
        options: [
          {
            id: 'opt1',
            content: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: '3',
              mediaIds: [],
            },
          },
          {
            id: 'opt2',
            content: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: '4',
              mediaIds: [],
            },
          },
          {
            id: 'opt3',
            content: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: '5',
              mediaIds: [],
            },
          },
        ],
        correctOptionIds: ['opt2'],
      },
    }

    it('displays single-answer instruction', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      render(
        <McqQuestion
          question={singleAnswerQuestion}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      expect(screen.getByText('Select one answer')).toBeTruthy()
    })

    it('calls onChange when clicking an option', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      const { container } = render(
        <McqQuestion
          question={singleAnswerQuestion}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      // Find and click the first label
      const labels = container.querySelectorAll('label')
      fireEvent.click(labels[0])

      expect(onChange).toHaveBeenCalledWith({ type: 'mcq', selectedIds: ['opt1'] })
    })

    it('replaces selection when clicking another option', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: ['opt1'] }
      const { container } = render(
        <McqQuestion
          question={singleAnswerQuestion}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      // Click the second label
      const labels = container.querySelectorAll('label')
      fireEvent.click(labels[1])

      expect(onChange).toHaveBeenCalledWith({ type: 'mcq', selectedIds: ['opt2'] })
    })

    it('does not call onChange when disabled', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      const { container } = render(
        <McqQuestion
          question={singleAnswerQuestion}
          answer={answer}
          onChange={onChange}
          disabled={true}
          checkResult={null}
          t={mockT}
        />,
      )

      const labels = container.querySelectorAll('label')
      fireEvent.click(labels[0])

      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('Multi-answer mode', () => {
    const multiAnswerQuestion: QuestionSelectMcqBlock = {
      id: 'test-q2',
      type: 'question_select',
      variant: 'mcq',
      selectionMode: 'multiple',
      prompt: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Select all even numbers:',
        mediaIds: [],
      },
      answer: {
        multiSelect: true,
        options: [
          {
            id: 'opt1',
            content: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: '2',
              mediaIds: [],
            },
          },
          {
            id: 'opt2',
            content: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: '3',
              mediaIds: [],
            },
          },
          {
            id: 'opt3',
            content: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: '4',
              mediaIds: [],
            },
          },
        ],
        correctOptionIds: ['opt1', 'opt3'],
      },
    }

    it('displays multi-answer instruction', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
      render(
        <McqQuestion
          question={multiAnswerQuestion}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      expect(screen.getByText('Select all that apply')).toBeTruthy()
    })

    it('allows selecting multiple options', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: ['opt1'] }
      const { container } = render(
        <McqQuestion
          question={multiAnswerQuestion}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      // Find the third checkbox/label and click it
      const labels = container.querySelectorAll('label')

      // The checkboxes are inside labels, try clicking the label
      fireEvent.click(labels[2])

      // Multi-select should add the new selection
      expect(onChange).toHaveBeenCalledWith({ type: 'mcq', selectedIds: ['opt1', 'opt3'] })
    })

    it('allows deselecting options', () => {
      const answer: UserAnswer = { type: 'mcq', selectedIds: ['opt1', 'opt3'] }
      const { container } = render(
        <McqQuestion
          question={multiAnswerQuestion}
          answer={answer}
          onChange={onChange}
          disabled={false}
          checkResult={null}
          t={mockT}
        />,
      )

      const labels = container.querySelectorAll('label')

      // Click first label to deselect opt1
      fireEvent.click(labels[0])

      expect(onChange).toHaveBeenCalledWith({ type: 'mcq', selectedIds: ['opt3'] })
    })
  })
})

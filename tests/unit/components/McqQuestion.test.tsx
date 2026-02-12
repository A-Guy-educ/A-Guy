// @vitest-environment jsdom
import { McqQuestion } from '@/ui/web/exerciserenderer/questions/McqQuestion'
import type { QuestionSelectMcqBlock, UserAnswer } from '@/ui/web/exerciserenderer/types'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

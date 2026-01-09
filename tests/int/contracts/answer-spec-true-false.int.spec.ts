import { describe, expect, it } from 'vitest'
import { AnswerSpecSchema } from '@/contracts'

describe('AnswerSpecSchema - True/False', () => {
  it('validates true_false answer spec (sections variant)', () => {
    const validSpec = {
      questionType: 'true_false',
      variant: 'sections',
      items: [
        {
          id: 'item1',
          label: 'Statement 1',
          correct: true,
          prompt: {
            id: 'prompt1',
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'The Earth is round.',
          },
        },
        {
          id: 'item2',
          label: 'Statement 2',
          correct: false,
          prompt: {
            id: 'prompt2',
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'The sky is green.',
          },
        },
      ],
    }
    expect(() => AnswerSpecSchema.parse(validSpec)).not.toThrow()
  })

  it('validates true_false with optional fields', () => {
    const validSpec = {
      questionType: 'true_false',
      variant: 'sections',
      items: [
        {
          id: 'item1',
          label: 'Statement 1',
          correct: true,
          prompt: {
            id: 'prompt1',
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'Test statement',
          },
          hint: {
            id: 'hint1',
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'This is a hint',
          },
          solution: {
            id: 'sol1',
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'This is the solution',
          },
        },
      ],
    }
    expect(() => AnswerSpecSchema.parse(validSpec)).not.toThrow()
  })

  it('rejects true_false with missing variant field', () => {
    const invalidSpec = {
      questionType: 'true_false',
      items: [],
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })

  it('rejects true_false with empty items array', () => {
    const invalidSpec = {
      questionType: 'true_false',
      variant: 'sections',
      items: [],
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })

  it('rejects mismatched fields (mcq fields with true_false type)', () => {
    const invalidSpec = {
      questionType: 'true_false',
      variant: 'sections',
      // These fields belong to mcq
      multiSelect: false,
      options: [],
      correctOptionIds: [],
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })
})

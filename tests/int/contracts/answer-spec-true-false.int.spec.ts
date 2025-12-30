import { describe, expect, it } from 'vitest'
import { AnswerSpecSchema } from '@/contracts'

describe('AnswerSpecSchema - True/False', () => {
  it('validates true_false answer spec (true)', () => {
    const validSpec = {
      questionType: 'true_false',
      correct: true,
    }
    expect(() => AnswerSpecSchema.parse(validSpec)).not.toThrow()
  })

  it('validates true_false answer spec (false)', () => {
    const validSpec = {
      questionType: 'true_false',
      correct: false,
    }
    expect(() => AnswerSpecSchema.parse(validSpec)).not.toThrow()
  })

  it('rejects true_false with missing correct field', () => {
    const invalidSpec = {
      questionType: 'true_false',
      // Missing correct
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })

  it('rejects mismatched fields (mcq fields with true_false type)', () => {
    const invalidSpec = {
      questionType: 'true_false',
      // These fields belong to mcq
      multiSelect: false,
      options: [],
      correctOptionIds: [],
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })
})

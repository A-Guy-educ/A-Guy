/**
 * Unit tests for checkAnswer function
 * NOTE: These tests are for the legacy checkAnswer utility
 */

import { describe, test, expect } from 'vitest'
import { checkAnswer } from '@/ui/web/exerciserenderer/utils/checkAnswer'
import type { AnswerSpec } from '@/contracts'

// Legacy UserAnswer types for the old exercise format
type LegacyUserAnswer =
  | { type: 'mcq'; selectedIds: string[] }
  | { type: 'true_false'; sections: Record<string, boolean | null> }
  | { type: 'free_response'; value: string }

describe('checkAnswer', () => {
  describe('MCQ - Single Select', () => {
    const spec: AnswerSpec = {
      questionType: 'mcq',
      multiSelect: false,
      options: [
        { id: 'opt1', content: [] },
        { id: 'opt2', content: [] },
        { id: 'opt3', content: [] },
      ],
      correctOptionIds: ['opt2'],
    }

    test('returns correct for correct answer', () => {
      const answer: LegacyUserAnswer = { type: 'mcq', selectedIds: ['opt2'] }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns incorrect for wrong answer', () => {
      const answer: LegacyUserAnswer = { type: 'mcq', selectedIds: ['opt1'] }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
    })

    test('returns error for empty selection', () => {
      const answer: LegacyUserAnswer = { type: 'mcq', selectedIds: [] }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
      expect(result.message).toBe('Please select an answer')
    })
  })

  describe('MCQ - Multi Select', () => {
    const spec: AnswerSpec = {
      questionType: 'mcq',
      multiSelect: true,
      options: [
        { id: 'opt1', content: [] },
        { id: 'opt2', content: [] },
        { id: 'opt3', content: [] },
      ],
      correctOptionIds: ['opt1', 'opt3'],
    }

    test('returns correct for all correct answers', () => {
      const answer: LegacyUserAnswer = { type: 'mcq', selectedIds: ['opt1', 'opt3'] }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns correct for answers in different order', () => {
      const answer: LegacyUserAnswer = { type: 'mcq', selectedIds: ['opt3', 'opt1'] }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns incorrect for partial selection', () => {
      const answer: LegacyUserAnswer = { type: 'mcq', selectedIds: ['opt1'] }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
    })

    test('returns incorrect for extra selections', () => {
      const answer: LegacyUserAnswer = { type: 'mcq', selectedIds: ['opt1', 'opt2', 'opt3'] }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
    })
  })

  describe('True/False', () => {
    const spec: AnswerSpec = {
      questionType: 'true_false',
      variant: 'sections',
      items: [
        {
          id: 'a',
          label: 'A',
          correct: true,
          prompt: {
            id: 'a_p1',
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'Statement A',
            mediaIds: [],
          },
        },
        {
          id: 'b',
          label: 'B',
          correct: false,
          prompt: {
            id: 'b_p1',
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'Statement B',
            mediaIds: [],
          },
        },
      ],
    }

    test('returns correct when all sections are correct', () => {
      const answer: LegacyUserAnswer = {
        type: 'true_false',
        sections: {
          a: true,
          b: false,
        },
      }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns incorrect when any section is wrong', () => {
      const answer: LegacyUserAnswer = {
        type: 'true_false',
        sections: {
          a: true,
          b: true, // Wrong
        },
      }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
    })

    test('returns incorrect when sections are missing', () => {
      const answer: LegacyUserAnswer = {
        type: 'true_false',
        sections: {
          a: true,
          // missing 'b'
        },
      }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
      expect(result.message).toContain('Please answer all sections')
    })
  })

  describe('Free Response - Numeric', () => {
    const spec: AnswerSpec = {
      questionType: 'free_response',
      responseKind: 'numeric',
      acceptedAnswers: ['42'],
      tolerance: 0,
    }

    test('returns correct for exact numeric match', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '42' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns correct for decimal match', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '42.0' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns incorrect for wrong number', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '43' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
    })

    test('returns error for non-numeric input', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: 'abc' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
      expect(result.message).toBe('Please enter a valid number')
    })

    test('returns error for empty input', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
      expect(result.message).toBe('Please enter an answer')
    })
  })

  describe('Free Response - Numeric with Tolerance', () => {
    const spec: AnswerSpec = {
      questionType: 'free_response',
      responseKind: 'numeric',
      acceptedAnswers: ['100'],
      tolerance: 5,
    }

    test('returns correct for value within tolerance (upper)', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '105' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns correct for value within tolerance (lower)', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '95' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns correct for exact boundary', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '105.0' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns incorrect for value outside tolerance', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '106' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
    })
  })

  describe('Free Response - Numeric with Multiple Accepted Answers', () => {
    const spec: AnswerSpec = {
      questionType: 'free_response',
      responseKind: 'numeric',
      acceptedAnswers: ['10', '20', '30'],
      tolerance: 1,
    }

    test('returns correct for first accepted answer', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '10' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns correct for second accepted answer within tolerance', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '21' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns incorrect for value between accepted answers but outside tolerance', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '15' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
    })
  })

  describe('Free Response - Algebraic', () => {
    const spec: AnswerSpec = {
      questionType: 'free_response',
      responseKind: 'algebraic',
      acceptedAnswers: ['2x+3', 'x^2-1'],
    }

    test('returns correct for exact match', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '2x+3' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns correct for match with whitespace normalized', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '2x + 3' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns correct for second accepted answer', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: 'x^2-1' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(true)
    })

    test('returns incorrect for algebraically equivalent but different form (v0)', () => {
      const answer: LegacyUserAnswer = { type: 'free_response', value: '3+2x' }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
    })
  })

  describe('Free Response - Text', () => {
    describe('Case Insensitive', () => {
      const spec: AnswerSpec = {
        questionType: 'free_response',
        responseKind: 'text',
        acceptedAnswers: ['photosynthesis', 'mitochondria'],
        caseSensitive: false,
        normalizeWhitespace: true,
      }

      test('returns correct for exact match', () => {
        const answer: LegacyUserAnswer = { type: 'free_response', value: 'photosynthesis' }
        const result = checkAnswer(spec, answer)
        expect(result.isCorrect).toBe(true)
      })

      test('returns correct for uppercase match', () => {
        const answer: LegacyUserAnswer = { type: 'free_response', value: 'PHOTOSYNTHESIS' }
        const result = checkAnswer(spec, answer)
        expect(result.isCorrect).toBe(true)
      })

      test('returns correct for mixed case match', () => {
        const answer: LegacyUserAnswer = { type: 'free_response', value: 'PhotoSynthesis' }
        const result = checkAnswer(spec, answer)
        expect(result.isCorrect).toBe(true)
      })

      test('returns incorrect for wrong answer', () => {
        const answer: LegacyUserAnswer = { type: 'free_response', value: 'chloroplast' }
        const result = checkAnswer(spec, answer)
        expect(result.isCorrect).toBe(false)
      })
    })

    describe('Case Sensitive', () => {
      const spec: AnswerSpec = {
        questionType: 'free_response',
        responseKind: 'text',
        acceptedAnswers: ['JavaScript'],
        caseSensitive: true,
        normalizeWhitespace: true,
      }

      test('returns correct for exact case match', () => {
        const answer: LegacyUserAnswer = { type: 'free_response', value: 'JavaScript' }
        const result = checkAnswer(spec, answer)
        expect(result.isCorrect).toBe(true)
      })

      test('returns incorrect for different case', () => {
        const answer: LegacyUserAnswer = { type: 'free_response', value: 'javascript' }
        const result = checkAnswer(spec, answer)
        expect(result.isCorrect).toBe(false)
      })
    })

    describe('Whitespace Normalization', () => {
      const spec: AnswerSpec = {
        questionType: 'free_response',
        responseKind: 'text',
        acceptedAnswers: ['New York'],
        caseSensitive: false,
        normalizeWhitespace: true,
      }

      test('returns correct with extra spaces', () => {
        const answer: LegacyUserAnswer = { type: 'free_response', value: 'New  York' }
        const result = checkAnswer(spec, answer)
        expect(result.isCorrect).toBe(true)
      })

      test('returns correct with leading/trailing spaces', () => {
        const answer: LegacyUserAnswer = { type: 'free_response', value: '  New York  ' }
        const result = checkAnswer(spec, answer)
        expect(result.isCorrect).toBe(true)
      })
    })
  })

  describe('Type Mismatch', () => {
    test('returns error for MCQ spec with wrong answer type', () => {
      const spec: AnswerSpec = {
        questionType: 'mcq',
        multiSelect: false,
        options: [{ id: 'opt1', content: [] }],
        correctOptionIds: ['opt1'],
      }
      const answer: LegacyUserAnswer = { type: 'true_false', sections: {} }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
      expect(result.message).toBe('Invalid answer type')
    })

    test('returns error for True/False spec with wrong answer type', () => {
      const spec: AnswerSpec = {
        questionType: 'true_false',
        variant: 'sections',
        items: [
          {
            id: 'a',
            label: 'A',
            correct: true,
            prompt: {
              id: 'a_p1',
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Statement A',
              mediaIds: [],
            },
          },
        ],
      }
      const answer: LegacyUserAnswer = { type: 'mcq', selectedIds: [] }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
      expect(result.message).toBe('Invalid answer type')
    })

    test('returns error for Free Response spec with wrong answer type', () => {
      const spec: AnswerSpec = {
        questionType: 'free_response',
        responseKind: 'numeric',
        acceptedAnswers: ['42'],
      }
      const answer: LegacyUserAnswer = { type: 'mcq', selectedIds: [] }
      const result = checkAnswer(spec, answer)
      expect(result.isCorrect).toBe(false)
      expect(result.message).toBe('Invalid answer type')
    })
  })
})

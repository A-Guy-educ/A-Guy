import { describe, expect, it } from 'vitest'
import { AnswerSpecSchema } from '@/contracts'

describe('AnswerSpecSchema - Free Response', () => {
  it('validates free_response answer spec (numeric)', () => {
    const validSpec = {
      questionType: 'free_response',
      responseKind: 'numeric',
      acceptedAnswers: ['3.14', '22/7'],
      tolerance: 0.01,
    }
    expect(() => AnswerSpecSchema.parse(validSpec)).not.toThrow()
  })

  it('validates free_response answer spec (algebraic)', () => {
    const validSpec = {
      questionType: 'free_response',
      responseKind: 'algebraic',
      acceptedAnswers: ['x^2+2x+1', '(x+1)^2'],
    }
    expect(() => AnswerSpecSchema.parse(validSpec)).not.toThrow()
  })

  it('validates free_response answer spec (text)', () => {
    const validSpec = {
      questionType: 'free_response',
      responseKind: 'text',
      acceptedAnswers: ['photosynthesis', 'Photosynthesis'],
      caseSensitive: false,
      normalizeWhitespace: true,
    }
    expect(() => AnswerSpecSchema.parse(validSpec)).not.toThrow()
  })

  it('rejects free_response with no accepted answers', () => {
    const invalidSpec = {
      questionType: 'free_response',
      responseKind: 'numeric',
      acceptedAnswers: [], // Empty
      tolerance: 0.01,
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })

  it('rejects free_response with missing acceptedAnswers', () => {
    const invalidSpec = {
      questionType: 'free_response',
      responseKind: 'text',
      // Missing acceptedAnswers
      caseSensitive: true,
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })

  it('rejects numeric with caseSensitive (wrong field for responseKind)', () => {
    const invalidSpec = {
      questionType: 'free_response',
      responseKind: 'numeric',
      acceptedAnswers: ['3.14'],
      tolerance: 0.01,
      caseSensitive: true, // Invalid for numeric
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })

  it('rejects text with tolerance (wrong field for responseKind)', () => {
    const invalidSpec = {
      questionType: 'free_response',
      responseKind: 'text',
      acceptedAnswers: ['answer'],
      tolerance: 0.01, // Invalid for text
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })

  it('rejects algebraic with any optional field (none allowed)', () => {
    const invalidSpec = {
      questionType: 'free_response',
      responseKind: 'algebraic',
      acceptedAnswers: ['x^2+1'],
      tolerance: 0.01, // Invalid for algebraic
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })

  it('rejects free_response with unknown keys (strict mode)', () => {
    const invalidSpec = {
      questionType: 'free_response',
      responseKind: 'numeric',
      acceptedAnswers: ['3.14'],
      unknownField: 'should be rejected',
    }
    expect(() => AnswerSpecSchema.parse(invalidSpec)).toThrow()
  })
})

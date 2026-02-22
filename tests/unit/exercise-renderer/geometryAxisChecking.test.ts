import { describe, it, expect } from 'vitest'
import {
  checkQuestionAnswer,
  type AnswerErrorMessages,
} from '@/ui/web/exerciserenderer/utils/answerChecking'
import type {
  QuestionGeometryBlock,
  QuestionAxisBlock,
  QuestionAnswer,
} from '@/ui/web/exerciserenderer/types'

const messages: AnswerErrorMessages = {
  invalidAnswerType: 'Invalid answer type',
  selectTrueFalse: 'Select true or false',
  noCorrectAnswer: 'No correct answer defined',
  selectAnAnswer: 'Please select an answer',
  enterAnAnswer: 'Please enter an answer',
  unknownVariant: 'Unknown variant',
  validationFailed: 'Validation failed',
  validationError: 'Validation error',
  connectionError: 'Connection error',
}

function makeGeoBlock(answer?: QuestionAnswer): QuestionGeometryBlock {
  return {
    id: 'geo-1',
    type: 'question_geometry',
    prompt: { type: 'rich_text', format: 'md-math-v1', value: 'What is X?', mediaIds: [] },
    geometry: {
      kind: 'euclidean',
      canvas: { width: 600, height: 400 },
      elements: { points: [], lines: [], circles: [], angles: [] },
    },
    answer,
  }
}

function makeAxisBlock(answer?: QuestionAnswer): QuestionAxisBlock {
  return {
    id: 'axis-1',
    type: 'question_axis',
    prompt: { type: 'rich_text', format: 'md-math-v1', value: 'What is Y?', mediaIds: [] },
    axis: {
      kind: 'cartesian',
      units: 1,
      grid: { enabled: true },
      axes: {
        showNumbers: true,
        showLabels: true,
        ticks: 1,
        labels: { x: 'x', y: 'y' },
        origin: { x: 0, y: 0 },
      },
      elements: { points: [], graphs: [] },
    },
    answer,
  }
}

describe('geometry answer checking', () => {
  describe('numeric', () => {
    const block = makeGeoBlock({ kind: 'numeric', value: 42 })

    it('returns correct for exact match', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'numeric', numericValue: 42 },
        messages,
      )
      expect(result.isCorrect).toBe(true)
    })

    it('returns correct within default tolerance', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'numeric', numericValue: 42.005 },
        messages,
      )
      expect(result.isCorrect).toBe(true)
    })

    it('returns incorrect outside tolerance', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'numeric', numericValue: 43 },
        messages,
      )
      expect(result.isCorrect).toBe(false)
    })

    it('returns error for missing value', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'numeric' },
        messages,
      )
      expect(result.isCorrect).toBe(false)
      expect(result.message).toBe('Please enter an answer')
    })
  })

  describe('mcq', () => {
    const block = makeGeoBlock({
      kind: 'mcq',
      options: [
        { id: 'a', content: { type: 'rich_text', format: 'md-math-v1', value: 'A', mediaIds: [] } },
        { id: 'b', content: { type: 'rich_text', format: 'md-math-v1', value: 'B', mediaIds: [] } },
      ],
      correctOptionIds: ['a'],
    })

    it('returns correct for right selection', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'mcq', selectedOptionIds: ['a'] },
        messages,
      )
      expect(result.isCorrect).toBe(true)
    })

    it('returns incorrect for wrong selection', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'mcq', selectedOptionIds: ['b'] },
        messages,
      )
      expect(result.isCorrect).toBe(false)
    })

    it('returns error for no selection', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'mcq', selectedOptionIds: [] },
        messages,
      )
      expect(result.isCorrect).toBe(false)
      expect(result.message).toBe('Please select an answer')
    })
  })

  describe('free_response', () => {
    const block = makeGeoBlock({ kind: 'free_response', acceptedAnswers: ['Triangle', 'triangle'] })

    it('returns correct for exact match', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'free_response', textValue: 'Triangle' },
        messages,
      )
      expect(result.isCorrect).toBe(true)
    })

    it('returns correct for case-insensitive match', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'free_response', textValue: 'TRIANGLE' },
        messages,
      )
      expect(result.isCorrect).toBe(true)
    })

    it('returns incorrect for wrong answer', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'free_response', textValue: 'Square' },
        messages,
      )
      expect(result.isCorrect).toBe(false)
    })

    it('returns error for empty answer', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'free_response', textValue: '' },
        messages,
      )
      expect(result.isCorrect).toBe(false)
      expect(result.message).toBe('Please enter an answer')
    })
  })

  describe('point', () => {
    const block = makeGeoBlock({ kind: 'point', x: 3, y: 5 })

    it('returns correct for exact match', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'point', point: { x: 3, y: 5 } },
        messages,
      )
      expect(result.isCorrect).toBe(true)
    })

    it('returns correct within tolerance', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'point', point: { x: 3.005, y: 4.995 } },
        messages,
      )
      expect(result.isCorrect).toBe(true)
    })

    it('returns incorrect when x is wrong', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'point', point: { x: 10, y: 5 } },
        messages,
      )
      expect(result.isCorrect).toBe(false)
    })

    it('returns error for missing point', async () => {
      const result = await checkQuestionAnswer(block, { type: 'geometry', kind: 'point' }, messages)
      expect(result.isCorrect).toBe(false)
      expect(result.message).toBe('Please enter an answer')
    })
  })

  describe('function', () => {
    const block = makeGeoBlock({ kind: 'function', acceptedExpressions: ['x^2 + 1'] })

    it('returns correct for exact match', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'function', functionExpression: 'x^2 + 1' },
        messages,
      )
      expect(result.isCorrect).toBe(true)
    })

    it('returns correct with whitespace normalization', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'function', functionExpression: 'x^2+1' },
        messages,
      )
      expect(result.isCorrect).toBe(true)
    })

    it('returns incorrect for wrong expression', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'function', functionExpression: 'x^3' },
        messages,
      )
      expect(result.isCorrect).toBe(false)
    })

    it('returns error for empty expression', async () => {
      const result = await checkQuestionAnswer(
        block,
        { type: 'geometry', kind: 'function', functionExpression: '' },
        messages,
      )
      expect(result.isCorrect).toBe(false)
      expect(result.message).toBe('Please enter an answer')
    })
  })

  it('returns error when no answer defined', async () => {
    const block = makeGeoBlock(undefined)
    const result = await checkQuestionAnswer(
      block,
      { type: 'geometry', kind: 'numeric', numericValue: 42 },
      messages,
    )
    expect(result.isCorrect).toBe(false)
    expect(result.message).toBe('No correct answer defined')
  })

  it('returns error for wrong answer type', async () => {
    const block = makeGeoBlock({ kind: 'numeric', value: 42 })
    const result = await checkQuestionAnswer(block, { type: 'matching', connections: [] }, messages)
    expect(result.isCorrect).toBe(false)
    expect(result.message).toBe('Invalid answer type')
  })
})

describe('axis answer checking', () => {
  it('returns correct for numeric match', async () => {
    const block = makeAxisBlock({ kind: 'numeric', value: 7 })
    const result = await checkQuestionAnswer(
      block,
      { type: 'axis', kind: 'numeric', numericValue: 7 },
      messages,
    )
    expect(result.isCorrect).toBe(true)
  })

  it('returns incorrect for wrong numeric answer', async () => {
    const block = makeAxisBlock({ kind: 'numeric', value: 7 })
    const result = await checkQuestionAnswer(
      block,
      { type: 'axis', kind: 'numeric', numericValue: 10 },
      messages,
    )
    expect(result.isCorrect).toBe(false)
  })

  it('returns error when no answer defined', async () => {
    const block = makeAxisBlock(undefined)
    const result = await checkQuestionAnswer(
      block,
      { type: 'axis', kind: 'numeric', numericValue: 42 },
      messages,
    )
    expect(result.isCorrect).toBe(false)
    expect(result.message).toBe('No correct answer defined')
  })

  it('returns correct for function expression match', async () => {
    const block = makeAxisBlock({ kind: 'function', acceptedExpressions: ['2*x + 3'] })
    const result = await checkQuestionAnswer(
      block,
      { type: 'axis', kind: 'function', functionExpression: '2*x+3' },
      messages,
    )
    expect(result.isCorrect).toBe(true)
  })
})

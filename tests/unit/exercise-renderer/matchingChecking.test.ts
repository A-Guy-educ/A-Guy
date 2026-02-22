import { describe, it, expect } from 'vitest'
import {
  checkQuestionAnswer,
  getInitialAnswer,
} from '@/ui/web/exerciserenderer/utils/answerChecking'
import type { QuestionMatchingBlock } from '@/server/payload/collections/Exercises/types'
import type { UserAnswer } from '@/ui/web/exerciserenderer/types'

const MESSAGES = {
  invalidAnswerType: 'Invalid answer type',
  selectTrueFalse: 'Select true/false',
  noCorrectAnswer: 'No correct answer',
  selectAnAnswer: 'Select an answer',
  enterAnAnswer: 'Enter an answer',
  unknownVariant: 'Unknown variant',
  validationFailed: 'Validation failed',
  validationError: 'Validation error',
  connectionError: 'Connection error',
}

function makeMatchingBlock(overrides: Partial<QuestionMatchingBlock> = {}): QuestionMatchingBlock {
  return {
    id: 'q1',
    type: 'question_matching',
    prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Match:', mediaIds: [] },
    leftColumn: [
      { id: 'l1', content: { type: 'rich_text', format: 'md-math-v1', value: 'A', mediaIds: [] } },
      { id: 'l2', content: { type: 'rich_text', format: 'md-math-v1', value: 'B', mediaIds: [] } },
      { id: 'l3', content: { type: 'rich_text', format: 'md-math-v1', value: 'C', mediaIds: [] } },
    ],
    rightColumn: [
      { id: 'r1', content: { type: 'rich_text', format: 'md-math-v1', value: '1', mediaIds: [] } },
      { id: 'r2', content: { type: 'rich_text', format: 'md-math-v1', value: '2', mediaIds: [] } },
      { id: 'r3', content: { type: 'rich_text', format: 'md-math-v1', value: '3', mediaIds: [] } },
    ],
    correctPairs: [
      { optionId: 'l1', matchId: 'r1' },
      { optionId: 'l2', matchId: 'r2' },
      { optionId: 'l3', matchId: 'r3' },
    ],
    shuffleRightColumn: true,
    ...overrides,
  }
}

describe('matching answer checking', () => {
  it('returns correct for exact match of all pairs', async () => {
    const block = makeMatchingBlock()
    const answer: UserAnswer = {
      type: 'matching',
      connections: [
        { leftId: 'l1', rightId: 'r1' },
        { leftId: 'l2', rightId: 'r2' },
        { leftId: 'l3', rightId: 'r3' },
      ],
    }
    const result = await checkQuestionAnswer(block, answer, MESSAGES)
    expect(result.isCorrect).toBe(true)
  })

  it('returns correct when pairs are in different order', async () => {
    const block = makeMatchingBlock()
    const answer: UserAnswer = {
      type: 'matching',
      connections: [
        { leftId: 'l3', rightId: 'r3' },
        { leftId: 'l1', rightId: 'r1' },
        { leftId: 'l2', rightId: 'r2' },
      ],
    }
    const result = await checkQuestionAnswer(block, answer, MESSAGES)
    expect(result.isCorrect).toBe(true)
  })

  it('returns incorrect with partial score for partial match', async () => {
    const block = makeMatchingBlock()
    const answer: UserAnswer = {
      type: 'matching',
      connections: [
        { leftId: 'l1', rightId: 'r1' },
        { leftId: 'l2', rightId: 'r3' },
        { leftId: 'l3', rightId: 'r2' },
      ],
    }
    const result = await checkQuestionAnswer(block, answer, MESSAGES)
    expect(result.isCorrect).toBe(false)
    expect(result.message).toBe('1/3')
  })

  it('returns error for empty connections', async () => {
    const block = makeMatchingBlock()
    const answer: UserAnswer = { type: 'matching', connections: [] }
    const result = await checkQuestionAnswer(block, answer, MESSAGES)
    expect(result.isCorrect).toBe(false)
    expect(result.message).toBe(MESSAGES.selectAnAnswer)
  })

  it('returns error for wrong answer type', async () => {
    const block = makeMatchingBlock()
    const answer: UserAnswer = { type: 'mcq', selectedIds: [] }
    const result = await checkQuestionAnswer(block, answer, MESSAGES)
    expect(result.isCorrect).toBe(false)
    expect(result.message).toBe(MESSAGES.invalidAnswerType)
  })

  it('returns incorrect when fewer connections than correct pairs', async () => {
    const block = makeMatchingBlock()
    const answer: UserAnswer = {
      type: 'matching',
      connections: [{ leftId: 'l1', rightId: 'r1' }],
    }
    const result = await checkQuestionAnswer(block, answer, MESSAGES)
    expect(result.isCorrect).toBe(false)
    expect(result.message).toBe('1/3')
  })

  it('handles single pair correctly', async () => {
    const block = makeMatchingBlock({
      leftColumn: [
        {
          id: 'l1',
          content: { type: 'rich_text', format: 'md-math-v1', value: 'A', mediaIds: [] },
        },
      ],
      rightColumn: [
        {
          id: 'r1',
          content: { type: 'rich_text', format: 'md-math-v1', value: '1', mediaIds: [] },
        },
      ],
      correctPairs: [{ optionId: 'l1', matchId: 'r1' }],
    })
    const answer: UserAnswer = {
      type: 'matching',
      connections: [{ leftId: 'l1', rightId: 'r1' }],
    }
    const result = await checkQuestionAnswer(block, answer, MESSAGES)
    expect(result.isCorrect).toBe(true)
  })
})

describe('matching getInitialAnswer', () => {
  it('returns empty matching answer', () => {
    const block = makeMatchingBlock()
    const initial = getInitialAnswer(block)
    expect(initial).toEqual({ type: 'matching', connections: [] })
  })
})

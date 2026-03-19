import { describe, it, expect } from 'vitest'
import { buildSupportUserPrompt } from '@/infra/llm/services/support-generation-prompt-builder'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

function makeMcqBlock(overrides?: Partial<ContentBlock>): ContentBlock {
  return {
    id: 'block-1',
    type: 'question_select',
    variant: 'mcq',
    prompt: { type: 'rich_text', format: 'md-math-v1', value: 'What is 2+2?', mediaIds: [] },
    answer: {
      options: [
        { id: 'a', content: { type: 'rich_text', format: 'md-math-v1', value: '3', mediaIds: [] } },
        { id: 'b', content: { type: 'rich_text', format: 'md-math-v1', value: '4', mediaIds: [] } },
      ],
      correctOptionIds: ['b'],
    },
    ...overrides,
  } as unknown as ContentBlock
}

function makeTrueFalseBlock(): ContentBlock {
  return {
    id: 'block-2',
    type: 'question_select',
    variant: 'true_false',
    prompt: { type: 'rich_text', format: 'md-math-v1', value: 'The sky is blue', mediaIds: [] },
    answer: { correctOptionId: 'true' },
  } as unknown as ContentBlock
}

function makeFreeResponseBlock(): ContentBlock {
  return {
    id: 'block-3',
    type: 'question_free_response',
    prompt: {
      type: 'rich_text',
      format: 'md-math-v1',
      value: 'Name the capital of France',
      mediaIds: [],
    },
    answer: { acceptedAnswers: ['Paris', 'paris'] },
  } as unknown as ContentBlock
}

function makeMatchingBlock(): ContentBlock {
  return {
    id: 'block-4',
    type: 'question_matching',
    prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Match the pairs', mediaIds: [] },
    leftColumn: [
      {
        id: 'l1',
        content: { type: 'rich_text', format: 'md-math-v1', value: 'Dog', mediaIds: [] },
      },
    ],
    rightColumn: [
      {
        id: 'r1',
        content: { type: 'rich_text', format: 'md-math-v1', value: 'Animal', mediaIds: [] },
      },
    ],
    correctPairs: [{ optionId: 'l1', matchId: 'r1' }],
  } as unknown as ContentBlock
}

function makeTableBlock(solutionFill: boolean): ContentBlock {
  return {
    id: 'block-5',
    type: 'question_table',
    prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Fill the table', mediaIds: [] },
    table: {
      solutionFill,
      answers: solutionFill ? { r0c1: '42' } : undefined,
    },
  } as unknown as ContentBlock
}

describe('buildSupportUserPrompt', () => {
  it('includes exercise title when provided', () => {
    const prompt = buildSupportUserPrompt({
      block: makeMcqBlock(),
      exerciseTitle: 'Math Basics',
      targetFields: ['hints', 'solution', 'fullSolution'],
    })
    expect(prompt).toContain('Exercise: "Math Basics"')
  })

  it('omits exercise title when not provided', () => {
    const prompt = buildSupportUserPrompt({
      block: makeMcqBlock(),
      targetFields: ['hints'],
    })
    expect(prompt).not.toContain('Exercise:')
  })

  it('includes block type', () => {
    const prompt = buildSupportUserPrompt({
      block: makeMcqBlock(),
      targetFields: ['hints'],
    })
    expect(prompt).toContain('Block Type: question_select')
  })

  it('includes variant for mcq blocks', () => {
    const prompt = buildSupportUserPrompt({
      block: makeMcqBlock(),
      targetFields: ['hints'],
    })
    expect(prompt).toContain('Variant: mcq')
  })

  it('extracts MCQ question text and correct options', () => {
    const prompt = buildSupportUserPrompt({
      block: makeMcqBlock(),
      targetFields: ['hints'],
    })
    expect(prompt).toContain('Question: What is 2+2?')
    expect(prompt).toContain('Correct option(s): 4')
    expect(prompt).toContain('Options:')
    expect(prompt).toContain('[a] 3')
    expect(prompt).toContain('[b] 4')
  })

  it('extracts true/false answer', () => {
    const prompt = buildSupportUserPrompt({
      block: makeTrueFalseBlock(),
      targetFields: ['hints'],
    })
    expect(prompt).toContain('Correct: true')
  })

  it('extracts free response accepted answers', () => {
    const prompt = buildSupportUserPrompt({
      block: makeFreeResponseBlock(),
      targetFields: ['hints'],
    })
    expect(prompt).toContain('Accepted answers: Paris, paris')
  })

  it('extracts matching pairs', () => {
    const prompt = buildSupportUserPrompt({
      block: makeMatchingBlock(),
      targetFields: ['hints'],
    })
    expect(prompt).toContain('Matching pairs: Dog -> Animal')
  })

  it('extracts table answers when solutionFill is true', () => {
    const prompt = buildSupportUserPrompt({
      block: makeTableBlock(true),
      targetFields: ['hints'],
    })
    expect(prompt).toContain('Table answers:')
    expect(prompt).toContain('Cell [r0c1]: 42')
  })

  it('indicates no solution fill for tables without it', () => {
    const prompt = buildSupportUserPrompt({
      block: makeTableBlock(false),
      targetFields: ['hints'],
    })
    expect(prompt).toContain('(table without solution fill)')
  })

  it('always includes JSON instruction', () => {
    const prompt = buildSupportUserPrompt({
      block: makeMcqBlock(),
      targetFields: ['hints'],
    })
    expect(prompt).toContain('Return a JSON object with ALL three keys')
  })
})

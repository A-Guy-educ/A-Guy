import { describe, it, expect } from 'vitest'
import {
  isQuestionBlock,
  hasExistingSupport,
  applyGeneratedSupport,
} from '@/server/payload/endpoints/exercises/generate-support/support-block-utils'
import type { ContentBlock, InlineRichText } from '@/server/payload/collections/Exercises/types'

function makeRichText(value: string): InlineRichText {
  return { type: 'rich_text', format: 'md-math-v1', value, mediaIds: [] }
}

function makeBlock(type: string, support?: Record<string, unknown>): ContentBlock {
  return {
    id: 'b1',
    type,
    prompt: makeRichText('Test question'),
    ...support,
  } as unknown as ContentBlock
}

describe('isQuestionBlock', () => {
  it.each([
    'question_select',
    'question_free_response',
    'question_table',
    'question_matching',
    'question_geometry',
    'question_axis',
    'svg',
  ])('returns true for %s', (type) => {
    expect(isQuestionBlock(makeBlock(type))).toBe(true)
  })

  it.each(['text', 'image', 'video', 'divider', 'callout'])('returns false for %s', (type) => {
    expect(isQuestionBlock(makeBlock(type))).toBe(false)
  })
})

describe('hasExistingSupport', () => {
  it('returns false for block without hint field', () => {
    expect(hasExistingSupport(makeBlock('question_select'))).toBe(false)
  })

  it('returns false for block with empty support fields', () => {
    const block = makeBlock('question_select', {
      hint: makeRichText(''),
      solution: makeRichText(''),
      fullSolution: makeRichText(''),
    })
    expect(hasExistingSupport(block)).toBe(false)
  })

  it('returns true when hint has content', () => {
    const block = makeBlock('question_select', {
      hint: makeRichText('Try thinking about...'),
    })
    expect(hasExistingSupport(block)).toBe(true)
  })

  it('returns true when solution has content', () => {
    const block = makeBlock('question_select', {
      hint: makeRichText(''),
      solution: makeRichText('The answer is 4'),
    })
    expect(hasExistingSupport(block)).toBe(true)
  })

  it('returns true when fullSolution has content', () => {
    const block = makeBlock('question_select', {
      hint: makeRichText(''),
      fullSolution: makeRichText('Step 1: ...'),
    })
    expect(hasExistingSupport(block)).toBe(true)
  })
})

describe('applyGeneratedSupport', () => {
  const generated = {
    hints: ['Hint 1', 'Hint 2'],
    solution: 'Think about what operation combines numbers',
    fullSolution: '2 + 2 = 4 because addition...',
  }

  it('applies all fields to empty block', () => {
    const block = makeBlock('question_select')
    const result = applyGeneratedSupport(block, generated, false) as ContentBlock & {
      hint?: InlineRichText
      solution?: InlineRichText
      fullSolution?: InlineRichText
    }

    expect(result.hint?.value).toBe('1. Hint 1\n2. Hint 2')
    expect(result.solution?.value).toBe('Think about what operation combines numbers')
    expect(result.fullSolution?.value).toBe('2 + 2 = 4 because addition...')
  })

  it('does not overwrite existing content when overwrite=false', () => {
    const block = makeBlock('question_select', {
      hint: makeRichText('Existing hint'),
      solution: makeRichText('Existing solution'),
    })
    const result = applyGeneratedSupport(block, generated, false) as ContentBlock & {
      hint?: InlineRichText
      solution?: InlineRichText
      fullSolution?: InlineRichText
    }

    expect(result.hint?.value).toBe('Existing hint')
    expect(result.solution?.value).toBe('Existing solution')
    expect(result.fullSolution?.value).toBe('2 + 2 = 4 because addition...')
  })

  it('overwrites existing content when overwrite=true', () => {
    const block = makeBlock('question_select', {
      hint: makeRichText('Old hint'),
      solution: makeRichText('Old solution'),
      fullSolution: makeRichText('Old full'),
    })
    const result = applyGeneratedSupport(block, generated, true) as ContentBlock & {
      hint?: InlineRichText
      solution?: InlineRichText
      fullSolution?: InlineRichText
    }

    expect(result.hint?.value).toBe('1. Hint 1\n2. Hint 2')
    expect(result.solution?.value).toBe('Think about what operation combines numbers')
    expect(result.fullSolution?.value).toBe('2 + 2 = 4 because addition...')
  })

  it('creates InlineRichText with correct format', () => {
    const block = makeBlock('question_select')
    const result = applyGeneratedSupport(block, generated, false) as ContentBlock & {
      hint?: InlineRichText
    }

    expect(result.hint?.type).toBe('rich_text')
    expect(result.hint?.format).toBe('md-math-v1')
    expect(result.hint?.mediaIds).toEqual([])
  })

  it('does not mutate the original block', () => {
    const block = makeBlock('question_select')
    const original = { ...block }
    applyGeneratedSupport(block, generated, false)

    expect(block).toEqual(original)
  })

  it('handles empty hints array gracefully', () => {
    const block = makeBlock('question_select')
    const result = applyGeneratedSupport(
      block,
      { hints: [], solution: 'Sol', fullSolution: 'Full' },
      false,
    ) as ContentBlock & {
      hint?: InlineRichText
      solution?: InlineRichText
    }

    expect(result.hint).toBeUndefined()
    expect(result.solution?.value).toBe('Sol')
  })
})

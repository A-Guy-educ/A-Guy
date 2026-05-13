import { describe, it, expect } from 'vitest'
import {
  LessonVariationOutputSchema,
  SolutionDerivationOutputSchema,
} from '@/infra/llm/schemas/lesson-duplication-output'

describe('LessonVariationOutputSchema', () => {
  it('accepts a minimal valid envelope', () => {
    const result = LessonVariationOutputSchema.safeParse({
      content: { blocks: [{ id: 'b1', type: 'question_select' }] },
    })
    expect(result.success).toBe(true)
  })

  it('preserves block-specific fields via passthrough', () => {
    const parsed = LessonVariationOutputSchema.parse({
      content: {
        blocks: [
          {
            id: 'b1',
            type: 'question_select',
            variant: 'mcq',
            answer: { options: [], correctOptionIds: ['a'] },
          },
        ],
      },
    }) as { content: { blocks: Array<Record<string, unknown>> } }

    expect(parsed.content.blocks[0]).toMatchObject({
      id: 'b1',
      type: 'question_select',
      variant: 'mcq',
    })
  })

  it('rejects missing content.blocks', () => {
    expect(LessonVariationOutputSchema.safeParse({ content: {} }).success).toBe(false)
  })

  it('rejects empty blocks array', () => {
    expect(LessonVariationOutputSchema.safeParse({ content: { blocks: [] } }).success).toBe(false)
  })

  it('rejects block missing id or type', () => {
    expect(
      LessonVariationOutputSchema.safeParse({
        content: { blocks: [{ id: 'b1' }] },
      }).success,
    ).toBe(false)
    expect(
      LessonVariationOutputSchema.safeParse({
        content: { blocks: [{ type: 'rich_text' }] },
      }).success,
    ).toBe(false)
  })
})

describe('SolutionDerivationOutputSchema', () => {
  it('accepts the full canonical pass-2 shape', () => {
    const result = SolutionDerivationOutputSchema.safeParse({
      solution: { type: 'rich_text', format: 'md-math-v1', value: 's', mediaIds: [] },
      fullSolution: { type: 'rich_text', format: 'md-math-v1', value: 'fs', mediaIds: [] },
      answer: { correctOptionIds: ['a'] },
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (every field is optional for non-MCQ blocks)', () => {
    expect(SolutionDerivationOutputSchema.safeParse({}).success).toBe(true)
  })

  it('rejects non-rich_text solution', () => {
    expect(SolutionDerivationOutputSchema.safeParse({ solution: 'plain string' }).success).toBe(
      false,
    )
  })

  it('passes through extra answer fields rather than failing', () => {
    const result = SolutionDerivationOutputSchema.parse({
      answer: { correctOptionIds: ['a'], extra: 'ignored-not-rejected' },
    }) as { answer: Record<string, unknown> }
    expect(result.answer.correctOptionIds).toEqual(['a'])
  })
})

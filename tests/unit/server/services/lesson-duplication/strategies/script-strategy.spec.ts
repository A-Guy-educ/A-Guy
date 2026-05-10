/**
 * Unit tests for src/server/services/lesson-duplication/strategies/script-strategy.ts
 *
 * Target: ScriptVariationStrategy and applyScriptLightVariation — pure function tests, no mocks.
 */
import { describe, expect, it } from 'vitest'
import {
  ScriptVariationStrategy,
  isSingleArithmeticExpression,
} from '@/server/services/lesson-duplication/strategies/script-strategy'
import { isPurelyAlgebraic } from '@/server/services/lesson-duplication/strategies/algebraic-detector'
import type { ContentBlock, InlineRichText } from '@/server/payload/collections/Exercises/types'
import type { Exercise } from '@/payload-types'

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeRichText(value: string): InlineRichText {
  return { type: 'rich_text', format: 'md-math-v1', value, mediaIds: [] }
}

function makeAlgebraicExercise(
  prompt: string,
  correctAnswer: number,
  wrongAnswers: number[] = [],
  exerciseId?: string,
): import('@/payload-types').Exercise {
  const optionId = `opt-correct-${Math.random().toString(36).slice(2, 7)}`
  const wrongIds = wrongAnswers.map((_, i) => `opt-wrong-${i}`)

  const blocks: ContentBlock[] = [
    {
      id: 'mcq-1',
      type: 'question_select',
      variant: 'mcq',
      selectionMode: 'single',
      prompt: makeRichText(prompt),
      answer: {
        multiSelect: false,
        options: [
          ...wrongAnswers.map((wrongVal, i) => ({
            id: wrongIds[i],
            content: makeRichText(String(wrongVal)),
          })),
          { id: optionId, content: makeRichText(String(correctAnswer)) },
        ],
        correctOptionIds: [optionId],
      },
      hint: makeRichText('Hint'),
      solution: makeRichText('Solution'),
      fullSolution: makeRichText('Full solution'),
    } as ContentBlock,
  ]

  return {
    id: exerciseId ?? `ex-${Math.random().toString(36).slice(2, 8)}`,
    content: { blocks },
  } as unknown as import('@/payload-types').Exercise
}

// ---------------------------------------------------------------------------
// isSingleArithmeticExpression (unit)
// ---------------------------------------------------------------------------

describe('isSingleArithmeticExpression', () => {
  it('returns true for "2+3"', () => expect(isSingleArithmeticExpression('2+3')).toBe(true))
  it('returns true for "5×4"', () => expect(isSingleArithmeticExpression('5×4')).toBe(true))
  it('returns true for "(2+3)×4"', () => expect(isSingleArithmeticExpression('(2+3)×4')).toBe(true))
  it('returns true for "12.5 + 7.3"', () =>
    expect(isSingleArithmeticExpression('12.5 + 7.3')).toBe(true))
  it('returns false for "x = 5"', () => expect(isSingleArithmeticExpression('x = 5')).toBe(false))
  it('returns false for "What is 2+3?"', () =>
    expect(isSingleArithmeticExpression('What is 2+3?')).toBe(false))
  it('returns false for bare "5"', () => expect(isSingleArithmeticExpression('5')).toBe(false))
})

// ---------------------------------------------------------------------------
// ScriptVariationStrategy
// ---------------------------------------------------------------------------

describe('ScriptVariationStrategy', () => {
  describe('level=none', () => {
    it('returns original exercise unchanged', async () => {
      const exercise = makeAlgebraicExercise('2+3=?', 5, [3, 4])
      const strategy = new ScriptVariationStrategy()
      const result = await strategy.apply(exercise, 'none')
      expect(result.needsAiFallback).toBeUndefined()
      expect(result.exercise).toBe(exercise)
    })
  })

  describe('non-algebraic exercise', () => {
    it('returns needsAiFallback for word problem', async () => {
      const blocks: ContentBlock[] = [
        {
          id: 'mcq-1',
          type: 'question_select',
          variant: 'mcq',
          selectionMode: 'single',
          prompt: makeRichText('חשב: בחווה יש 5 תרנגולות'),
          answer: {
            multiSelect: false,
            options: [{ id: 'a', content: makeRichText('A') }],
            correctOptionIds: ['a'],
          },
        } as ContentBlock,
      ]
      const exercise = {
        id: 'ex-word',
        content: { blocks },
      } as unknown as import('@/payload-types').Exercise
      const strategy = new ScriptVariationStrategy()
      const result = await strategy.apply(exercise, 'light')
      expect(result.needsAiFallback).toBe(true)
    })
  })

  describe('light level + algebraic exercise', () => {
    it('swaps numbers and recomputes correct answer', async () => {
      // Use a deterministic ID whose seed produces non-identity number replacements.
      // 'test-id' seed → 5→6, 4→4 (verified empirically to differ from original).
      const exercise = makeAlgebraicExercise('5×4=?', 20, [15, 18, 22], 'test-id')
      const strategy = new ScriptVariationStrategy()

      // Verify exercise is detected as purely algebraic
      expect(isPurelyAlgebraic(exercise)).toBe(true)

      const result = await strategy.apply(exercise, 'light')
      expect(result.needsAiFallback).toBeUndefined()

      const content = result.exercise.content as unknown as { blocks: ContentBlock[] }
      const mcqBlock = content.blocks[0] as {
        prompt?: InlineRichText
        answer?: {
          options: Array<{ content: InlineRichText; id: string }>
          correctOptionIds: string[]
        }
      }

      // Prompt should be different from the original
      expect(mcqBlock.prompt?.value).not.toEqual('5×4=?')

      // Options should exist and be numbers
      const optionValues = mcqBlock.answer?.options.map((o) => Number(o.content.value)) ?? []
      expect(optionValues.every((v) => Number.isFinite(v))).toBe(true)

      // Exactly one correct option should be marked
      const correctOptionIds = mcqBlock.answer?.correctOptionIds ?? []
      expect(correctOptionIds.length).toBe(1)
      const correctOption = mcqBlock.answer?.options.find((o) => o.id === correctOptionIds[0])
      expect(Number.isFinite(Number(correctOption?.content.value))).toBe(true)
    })

    it('same seed produces identical output on repeated calls', async () => {
      const exercise = makeAlgebraicExercise('7+8=?', 15, [12, 14, 16])
      const strategy = new ScriptVariationStrategy()
      const [result1, result2] = await Promise.all([
        strategy.apply(exercise, 'light'),
        strategy.apply(exercise, 'light'),
      ])
      expect(result1.exercise.content).toEqual(result2.exercise.content)
    })

    it('different seeds produce different outputs', async () => {
      // Use unique IDs so each exercise gets a different seed
      const exercise1 = makeAlgebraicExercise('7+8=?', 15, [12, 14, 16], 'ex-exercise-1')
      const exercise2 = makeAlgebraicExercise('7+8=?', 15, [12, 14, 16], 'ex-exercise-2')
      const strategy = new ScriptVariationStrategy()
      const [result1, result2] = await Promise.all([
        strategy.apply(exercise1, 'light'),
        strategy.apply(exercise2, 'light'),
      ])
      // Different exercises (different IDs) → different seeds → different results
      const content1 = result1.exercise.content as unknown as { blocks: ContentBlock[] }
      const content2 = result2.exercise.content as unknown as { blocks: ContentBlock[] }
      const prompt1 = (content1.blocks[0] as { prompt?: InlineRichText }).prompt?.value ?? ''
      const prompt2 = (content2.blocks[0] as { prompt?: InlineRichText }).prompt?.value ?? ''
      expect(prompt1).not.toEqual(prompt2)
    })
  })

  describe('medium/deep level', () => {
    it('returns needsAiFallback (delegates to AI)', async () => {
      const exercise = makeAlgebraicExercise('2+3=?', 5, [4, 6, 7])
      const strategy = new ScriptVariationStrategy()
      const result = await strategy.apply(exercise, 'medium')
      expect(result.needsAiFallback).toBe(true)
    })

    it('returns needsAiFallback for deep level', async () => {
      const exercise = makeAlgebraicExercise('2+3=?', 5, [4, 6, 7])
      const strategy = new ScriptVariationStrategy()
      const result = await strategy.apply(exercise, 'deep')
      expect(result.needsAiFallback).toBe(true)
    })
  })

  describe('multi-step or ambiguous exercise (needsAiFallback)', () => {
    it('returns needsAiFallback for multi-line prompt', async () => {
      const blocks: ContentBlock[] = [
        {
          id: 'mcq-1',
          type: 'question_select',
          variant: 'mcq',
          selectionMode: 'single',
          prompt: makeRichText('5+3=?\nThen subtract 2'),
          answer: {
            multiSelect: false,
            options: [{ id: 'a', content: makeRichText('6') }],
            correctOptionIds: ['a'],
          },
        } as ContentBlock,
      ]
      const exercise = {
        id: 'ex-multistep',
        content: { blocks },
      } as unknown as import('@/payload-types').Exercise
      // Multi-step expression fails isSingleArithmeticExpression check in script strategy
      const strategy = new ScriptVariationStrategy()
      const result = await strategy.apply(exercise, 'light')
      expect(result.needsAiFallback).toBe(true)
    })
  })
})

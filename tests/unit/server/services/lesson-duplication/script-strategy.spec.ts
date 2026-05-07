/**
 * Unit tests for ScriptVariationStrategy and VariationRouter.
 */
import { describe, expect, it } from 'vitest'

import { ScriptVariationStrategy } from '@/server/services/lesson-duplication/strategies/script-strategy'
import {
  AiStrategyNotImplementedError,
  VariationRouter,
} from '@/server/services/lesson-duplication/strategies/router'

const strategy = new ScriptVariationStrategy()

describe('ScriptVariationStrategy', () => {
  it('returns needsAiFallback for level=medium', async () => {
    const r = await strategy.apply({ text: '2 + 3' }, 'medium')
    expect(r.needsAiFallback).toBe(true)
  })

  it('returns needsAiFallback for level=deep', async () => {
    const r = await strategy.apply({ text: '2 + 3' }, 'deep')
    expect(r.needsAiFallback).toBe(true)
  })

  it('returns needsAiFallback when exercise is not algebraic', async () => {
    const r = await strategy.apply({ text: 'A train travels 100 km' }, 'light')
    expect(r.needsAiFallback).toBe(true)
  })

  it('rewrites numbers and recomputes the answer for a simple arithmetic exercise', async () => {
    const exercise = {
      text: '5 + 3',
      solution: '8',
    }
    const r = await strategy.apply(exercise, 'light', 7)
    expect(r.needsAiFallback).toBeFalsy()
    expect(r.exercise.text).not.toBe('5 + 3') // numbers changed
    // Solution must equal a real evaluation of the new text
    const evalResult = Function(`"use strict"; return (${r.exercise.text});`)()
    expect(Number(r.exercise.solution)).toBe(evalResult)
  })

  it('does not mutate the input exercise', async () => {
    const exercise = { text: '5 + 3', solution: '8' }
    const snapshot = JSON.stringify(exercise)
    await strategy.apply(exercise, 'light', 1)
    expect(JSON.stringify(exercise)).toBe(snapshot)
  })

  it('returns reproducible output for the same seed', async () => {
    const exercise = { text: '5 + 3', solution: '8' }
    const a = await strategy.apply(exercise, 'light', 42)
    const b = await strategy.apply(exercise, 'light', 42)
    expect(a.exercise).toEqual(b.exercise)
  })

  it('rewrites every section and keeps section count', async () => {
    const exercise = {
      text: 'חשב',
      sections: [
        { text: '2 + 2', solution: '4' },
        { text: '10 - 3', solution: '7' },
      ],
    }
    const r = await strategy.apply(exercise, 'light', 11)
    expect(r.needsAiFallback).toBeFalsy()
    expect(r.exercise.sections).toHaveLength(2)
    for (const section of r.exercise.sections!) {
      const evalResult = Function(`"use strict"; return (${section.text});`)()
      expect(Number(section.solution)).toBe(evalResult)
    }
  })

  it('falls back when a section text is non-trivial', async () => {
    const exercise = {
      text: 'חשב',
      sections: [{ text: 'x + 5 = 10', solution: '5' }],
    }
    const r = await strategy.apply(exercise, 'light', 1)
    expect(r.needsAiFallback).toBe(true)
  })
})

describe('VariationRouter', () => {
  it('uses script strategy for eligible light variations', async () => {
    const router = new VariationRouter()
    const r = await router.apply({ text: '5 + 3', solution: '8' }, 'light', 5)
    expect(r.needsAiFallback).toBeFalsy()
    expect(r.exercise.text).not.toBe('5 + 3')
  })

  it('falls through to placeholder AI strategy for medium/deep', async () => {
    const router = new VariationRouter()
    await expect(router.apply({ text: '5 + 3' }, 'medium')).rejects.toBeInstanceOf(
      AiStrategyNotImplementedError,
    )
  })

  it('falls through to AI when script declines (non-algebraic)', async () => {
    const router = new VariationRouter()
    await expect(
      router.apply({ text: 'A train travels 100 km/h' }, 'light'),
    ).rejects.toBeInstanceOf(AiStrategyNotImplementedError)
  })

  it('uses an injected AI strategy when provided', async () => {
    const fakeAi = {
      name: 'fake-ai',
      apply: async () => ({ exercise: { text: 'AI-OUTPUT' } }),
    }
    const router = new VariationRouter({ aiStrategy: fakeAi })
    const r = await router.apply({ text: '5 + 3' }, 'deep')
    expect(r.exercise.text).toBe('AI-OUTPUT')
  })
})

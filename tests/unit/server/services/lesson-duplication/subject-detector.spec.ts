/**
 * Unit tests for src/server/services/lesson-duplication/subject-detector.ts
 */
import { describe, expect, it } from 'vitest'

import { detectLessonSubject } from '@/server/services/lesson-duplication/subject-detector'

// Block factories — only fields the detector reads matter, the rest can be
// loose; cast through unknown so we don't have to satisfy the full Zod schema.
const geometryBlock = { id: 'g', type: 'question_geometry' } as unknown
const axisBlock = { id: 'a', type: 'question_axis' } as unknown
const multiAxisBlock = { id: 'ma', type: 'question_multi_axis' } as unknown
const richTextBlock = { id: 'r', type: 'rich_text' } as unknown
const mcqBlock = { id: 'q', type: 'question_select' } as unknown

function exerciseWith(blocks: unknown[]) {
  return { content: { blocks } } as never
}

describe('detectLessonSubject', () => {
  it('returns "algebra" when no exercises are provided', () => {
    expect(detectLessonSubject([])).toBe('algebra')
  })

  it('returns "algebra" when exercises have no geometry / axis blocks', () => {
    const exercises = [exerciseWith([richTextBlock, mcqBlock]), exerciseWith([richTextBlock])]
    expect(detectLessonSubject(exercises)).toBe('algebra')
  })

  it('returns "geometry" when any exercise has a geometry block and none have axis', () => {
    const exercises = [
      exerciseWith([richTextBlock]),
      exerciseWith([geometryBlock, richTextBlock]),
      exerciseWith([mcqBlock]),
    ]
    expect(detectLessonSubject(exercises)).toBe('geometry')
  })

  it('returns "calculus" when any exercise has an axis block and none have geometry', () => {
    const exercises = [exerciseWith([axisBlock, richTextBlock]), exerciseWith([mcqBlock])]
    expect(detectLessonSubject(exercises)).toBe('calculus')
  })

  it('treats question_multi_axis the same as question_axis', () => {
    expect(detectLessonSubject([exerciseWith([multiAxisBlock])])).toBe('calculus')
  })

  it('returns "mixed" when both geometry and axis blocks appear across exercises', () => {
    const exercises = [exerciseWith([geometryBlock]), exerciseWith([axisBlock])]
    expect(detectLessonSubject(exercises)).toBe('mixed')
  })

  it('returns "mixed" when one exercise contains both geometry and axis blocks', () => {
    const exercises = [exerciseWith([geometryBlock, axisBlock, richTextBlock])]
    expect(detectLessonSubject(exercises)).toBe('mixed')
  })

  it('handles missing content / blocks gracefully', () => {
    const exercises = [
      { content: null } as never,
      { content: { blocks: undefined } } as never,
      {} as never,
    ]
    expect(detectLessonSubject(exercises)).toBe('algebra')
  })
})

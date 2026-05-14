import { describe, it, expect } from 'vitest'
import { extractExerciseIdsFromLessonBlocks } from '@/server/services/lesson-duplication/source-exercises'

describe('extractExerciseIdsFromLessonBlocks', () => {
  it('parses ids from a parsed array of exerciseRef blocks', () => {
    const blocks = [
      { blockType: 'exerciseRef', exercise: 'ex-1', id: 'a' },
      { blockType: 'rich_text', value: 'intro' },
      { blockType: 'exerciseRef', exercise: 'ex-2', id: 'b' },
    ]
    expect(extractExerciseIdsFromLessonBlocks(blocks)).toEqual(['ex-1', 'ex-2'])
  })

  it('parses ids from a serialized JSON string', () => {
    const blocks = JSON.stringify([
      { blockType: 'exerciseRef', exercise: 'ex-9' },
      { blockType: 'exerciseRef', exercise: 'ex-10' },
    ])
    expect(extractExerciseIdsFromLessonBlocks(blocks)).toEqual(['ex-9', 'ex-10'])
  })

  it('handles populated relationships ({ exercise: { id } })', () => {
    const blocks = [{ blockType: 'exerciseRef', exercise: { id: 'ex-3', title: 'x' } }]
    expect(extractExerciseIdsFromLessonBlocks(blocks)).toEqual(['ex-3'])
  })

  it('preserves lesson order', () => {
    const blocks = [
      { blockType: 'exerciseRef', exercise: 'ex-c' },
      { blockType: 'exerciseRef', exercise: 'ex-a' },
      { blockType: 'exerciseRef', exercise: 'ex-b' },
    ]
    expect(extractExerciseIdsFromLessonBlocks(blocks)).toEqual(['ex-c', 'ex-a', 'ex-b'])
  })

  it('returns empty for non-array / malformed input', () => {
    expect(extractExerciseIdsFromLessonBlocks(null)).toEqual([])
    expect(extractExerciseIdsFromLessonBlocks(undefined)).toEqual([])
    expect(extractExerciseIdsFromLessonBlocks('not valid json {')).toEqual([])
    expect(extractExerciseIdsFromLessonBlocks(42)).toEqual([])
    expect(extractExerciseIdsFromLessonBlocks({ blocks: 'wrong' })).toEqual([])
  })

  it('skips non-exerciseRef block types', () => {
    const blocks = [
      { blockType: 'rich_text', value: 'hi' },
      { blockType: 'latex', latex: 'x^2' },
      { blockType: 'exerciseRef', exercise: 'ex-only' },
    ]
    expect(extractExerciseIdsFromLessonBlocks(blocks)).toEqual(['ex-only'])
  })

  it('skips exerciseRef blocks with missing/empty exercise field', () => {
    const blocks = [
      { blockType: 'exerciseRef' },
      { blockType: 'exerciseRef', exercise: '' },
      { blockType: 'exerciseRef', exercise: null },
      { blockType: 'exerciseRef', exercise: 'ex-valid' },
    ]
    expect(extractExerciseIdsFromLessonBlocks(blocks)).toEqual(['ex-valid'])
  })
})

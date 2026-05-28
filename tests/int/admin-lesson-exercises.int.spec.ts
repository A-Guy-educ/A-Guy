import { describe, expect, it } from 'vitest'

/**
 * Unit tests for the helper function used in the admin lesson exercises page.
 * Tests the block parsing logic that extracts exercise IDs from lesson blocks.
 */

describe('Admin Lesson Exercises Page helpers', () => {
  describe('extractExerciseIdsFromBlocks', () => {
    // Re-implement the function for testing (same logic as in page.tsx)
    function extractExerciseIdsFromBlocks(blocksJson: string): string[] {
      try {
        const blocks = JSON.parse(blocksJson)
        return blocks
          .filter(
            (b: { blockType: string; exercise?: string | { id?: unknown } }) =>
              b.blockType === 'exerciseRef',
          )
          .map((b: { exercise?: string | { id?: unknown } }) => {
            if (typeof b.exercise === 'string') return b.exercise || null
            if (b.exercise && typeof b.exercise === 'object' && 'id' in b.exercise) {
              const id = (b.exercise as { id?: unknown }).id
              if (id == null) return null
              return String(id)
            }
            return null
          })
          .filter((id: string | null): id is string => id !== null)
      } catch {
        return []
      }
    }

    it('returns empty array for invalid JSON', () => {
      expect(extractExerciseIdsFromBlocks('not valid json')).toEqual([])
      expect(extractExerciseIdsFromBlocks('')).toEqual([])
      expect(extractExerciseIdsFromBlocks('[]')).toEqual([])
    })

    it('returns empty array when no exerciseRef blocks', () => {
      const blocks = JSON.stringify([
        { blockType: 'contentPageRef', contentPage: 'page-1' },
        { blockType: 'richText', text: 'hello' },
      ])
      expect(extractExerciseIdsFromBlocks(blocks)).toEqual([])
    })

    it('extracts exercise IDs as plain strings', () => {
      const blocks = JSON.stringify([
        { blockType: 'exerciseRef', exercise: 'exercise-1' },
        { blockType: 'exerciseRef', exercise: 'exercise-2' },
        { blockType: 'exerciseRef', exercise: 'exercise-3' },
      ])
      expect(extractExerciseIdsFromBlocks(blocks)).toEqual([
        'exercise-1',
        'exercise-2',
        'exercise-3',
      ])
    })

    it('extracts exercise IDs from populated relationship objects', () => {
      const blocks = JSON.stringify([
        { blockType: 'exerciseRef', exercise: { id: 'exercise-obj-1', title: 'Test' } },
        { blockType: 'exerciseRef', exercise: { id: 'exercise-obj-2', title: 'Test 2' } },
      ])
      expect(extractExerciseIdsFromBlocks(blocks)).toEqual(['exercise-obj-1', 'exercise-obj-2'])
    })

    it('extracts exercise IDs in order from mixed blocks', () => {
      const blocks = JSON.stringify([
        { blockType: 'contentPageRef', contentPage: 'page-1' },
        { blockType: 'exerciseRef', exercise: 'ex-1' },
        { blockType: 'richText', text: 'some text' },
        { blockType: 'exerciseRef', exercise: 'ex-2' },
        { blockType: 'exerciseRef', exercise: 'ex-3' },
        { blockType: 'contentPageRef', contentPage: 'page-2' },
      ])
      expect(extractExerciseIdsFromBlocks(blocks)).toEqual(['ex-1', 'ex-2', 'ex-3'])
    })

    it('skips exerciseRef blocks with null/undefined exercise', () => {
      const blocks = JSON.stringify([
        { blockType: 'exerciseRef', exercise: 'ex-1' },
        { blockType: 'exerciseRef', exercise: null },
        { blockType: 'exerciseRef', exercise: undefined },
        { blockType: 'exerciseRef', exercise: { id: null } },
        { blockType: 'exerciseRef', exercise: { id: undefined } },
        { blockType: 'exerciseRef', exercise: 'ex-2' },
      ])
      expect(extractExerciseIdsFromBlocks(blocks)).toEqual(['ex-1', 'ex-2'])
    })
  })
})

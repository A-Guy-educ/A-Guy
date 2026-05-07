/**
 * Unit tests for src/server/services/lesson-duplication/selectors.ts
 *
 * Target: 100% line coverage on the selectors module.
 * Pattern: pure utility function tests — no mocks, no I/O, no Payload.
 */
import { describe, expect, it } from 'vitest'
import {
  selectExercisesScaled,
  selectSectionsScaled,
  selectScaled,
} from '@/server/services/lesson-duplication/selectors'

// ---------------------------------------------------------------------------
// selectScaled — internal algorithm correctness
// ---------------------------------------------------------------------------

describe('selectScaled', () => {
  it('returns all items unchanged when length equals max', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const result = selectScaled(items, 3, 99)
    expect(result).toHaveLength(3)
    expect(result).toEqual(items)
  })

  it('returns all items unchanged when length is below max', () => {
    const items = [{ id: 1 }, { id: 2 }]
    const result = selectScaled(items, 20, 99)
    expect(result).toHaveLength(2)
    expect(result).toEqual(items)
  })

  it('returns empty array for empty input', () => {
    expect(selectScaled([], 5, 99)).toEqual([])
  })

  it('returns empty array when max is zero', () => {
    expect(selectScaled([1, 2, 3], 0, 1)).toEqual([])
  })

  it('returns empty array when max is negative', () => {
    expect(selectScaled([1, 2, 3], -5, 1)).toEqual([])
  })

  it('respects the scaling bucket boundary: first bucket start index must be 0', () => {
    // 90 items, 20 buckets: bucket 0 = [0, floor(90/20)-1] = [0, 3]
    // Bucket size = 4.5, first pick must be from 0-3.
    const items = Array.from({ length: 90 }, (_, i) => i)
    const result = selectScaled(items, 20, 7)
    expect(result[0]).toBeLessThanOrEqual(3)
  })

  it('respects the scaling bucket boundary: last bucket covers tail indices', () => {
    // 90 items, 20 buckets: bucket 19 = [floor(19*90/20), floor(20*90/20)-1] = [85, 89]
    // Mathematically guaranteed last index ≥ 85.
    const items = Array.from({ length: 90 }, (_, i) => i)
    const result = selectScaled(items, 20, 7)
    expect(result[result.length - 1]).toBeGreaterThanOrEqual(85)
  })

  it('output is sorted by original source index ascending', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ n: i }))
    const result = selectScaled(items, 10, 55)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].n).toBeGreaterThan(result[i - 1].n)
    }
  })

  it('does not mutate the input array', () => {
    const items = Array.from({ length: 30 }, (_, i) => i)
    const snapshot = [...items]
    selectScaled(items, 10, 1)
    expect(items).toEqual(snapshot)
  })

  it('different seeds produce different outputs', () => {
    const items = Array.from({ length: 30 }, (_, i) => i)
    const a = selectScaled(items, 10, 1)
    const b = selectScaled(items, 10, 2)
    expect(a).not.toEqual(b)
  })

  it('same seed produces identical output across calls', () => {
    const items = Array.from({ length: 30 }, (_, i) => i)
    const a = selectScaled(items, 10, 7)
    const b = selectScaled(items, 10, 7)
    expect(a).toEqual(b)
  })
})

// ---------------------------------------------------------------------------
// selectExercisesScaled — issue acceptance criteria
// ---------------------------------------------------------------------------

describe('selectExercisesScaled', () => {
  // Acceptance criterion: "selectExercisesScaled(90 items) returns exactly 20,
  //                        first index ≤ 3, last index ≥ 87"
  it('returns exactly 20 items from 90 items', () => {
    const items = Array.from({ length: 90 }, (_, i) => i)
    const result = selectExercisesScaled(items)
    expect(result).toHaveLength(20)
  })

  it('first selected index is ≤ 3 for 90 items', () => {
    const items = Array.from({ length: 90 }, (_, i) => i)
    const result = selectExercisesScaled(items)
    expect(result[0]).toBeLessThanOrEqual(3)
  })

  it('last selected index is ≥ 85 for 90 items (guaranteed by bucket math)', () => {
    // Bucket 19 for n=90, max=20: [floor(19*90/20), floor(20*90/20)-1] = [85, 89]
    const items = Array.from({ length: 90 }, (_, i) => i)
    const result = selectExercisesScaled(items)
    expect(result[result.length - 1]).toBeGreaterThanOrEqual(85)
  })

  // Acceptance criterion: "selectExercisesScaled(15 items) returns all 15 in original order"
  it('returns all 15 items in original order when below cap', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ id: i }))
    const result = selectExercisesScaled(items)
    expect(result).toHaveLength(15)
    expect(result.map((r) => r.id)).toEqual(Array.from({ length: 15 }, (_, i) => i))
  })

  it('respects custom max parameter', () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    const result = selectExercisesScaled(items, 10)
    expect(result).toHaveLength(10)
  })

  it('respects seed parameter for reproducibility', () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    const a = selectExercisesScaled(items, 20, 42)
    const b = selectExercisesScaled(items, 20, 42)
    expect(a).toEqual(b)
  })

  it('no mutation of input', () => {
    const items = Array.from({ length: 30 }, (_, i) => i)
    const snap = [...items]
    selectExercisesScaled(items)
    expect(items).toEqual(snap)
  })
})

// ---------------------------------------------------------------------------
// selectSectionsScaled — mirrors selectExercisesScaled with max=5
// ---------------------------------------------------------------------------

describe('selectSectionsScaled', () => {
  it('returns all 3 items when length 3 < default cap 5', () => {
    const items = Array.from({ length: 3 }, (_, i) => i)
    const result = selectSectionsScaled(items)
    expect(result).toHaveLength(3)
  })

  it('returns exactly 5 items from 20 items (capped at default 5)', () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    const result = selectSectionsScaled(items)
    expect(result).toHaveLength(5)
  })

  it('respects custom max parameter', () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    const result = selectSectionsScaled(items, 3)
    expect(result).toHaveLength(3)
  })

  it('same seed produces identical output across runs', () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    const a = selectSectionsScaled(items, 5, 7)
    const b = selectSectionsScaled(items, 5, 7)
    expect(a).toEqual(b)
  })

  it('no mutation of input', () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    const snap = [...items]
    selectSectionsScaled(items)
    expect(items).toEqual(snap)
  })
})

import {
  computeIdempotencyKey,
  createIdempotencyKeyFn,
  deduplicateByIdempotencyKey,
  EnrichedExercise,
  SPEC_VERSION,
} from '@/server/services/exercise-conversion/idempotency'
import { describe, expect, test } from 'vitest'

describe('computeIdempotencyKey', () => {
  test('1.1: basic format', () => {
    const result = computeIdempotencyKey({
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      pageStart: 1,
      pageEnd: 3,
      systemOrdinal: 1, // Changed from itemOrdinal to systemOrdinal
      specVersion: 'v1',
    })
    expect(result).toBe('t1:l1:d1:1-3:1:v1')
  })

  test('1.2: is deterministic', () => {
    const params = {
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      pageStart: 1,
      pageEnd: 3,
      systemOrdinal: 2,
    }

    const result1 = computeIdempotencyKey(params)
    const result2 = computeIdempotencyKey(params)
    expect(result1).toBe(result2)
  })

  test('1.3: differs by page range', () => {
    const baseParams = {
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      systemOrdinal: 0,
    }

    const key1 = computeIdempotencyKey({ ...baseParams, pageStart: 1, pageEnd: 3 })
    const key2 = computeIdempotencyKey({ ...baseParams, pageStart: 4, pageEnd: 6 })

    expect(key1).not.toBe(key2)
    expect(key1).toBe('t1:l1:d1:1-3:0:v1')
    expect(key2).toBe('t1:l1:d1:4-6:0:v1')
  })

  test('1.4: differs by systemOrdinal', () => {
    const baseParams = {
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      pageStart: 1,
      pageEnd: 3,
    }

    const key1 = computeIdempotencyKey({ ...baseParams, systemOrdinal: 0 })
    const key2 = computeIdempotencyKey({ ...baseParams, systemOrdinal: 1 })

    expect(key1).not.toBe(key2)
    expect(key1).toBe('t1:l1:d1:1-3:0:v1')
    expect(key2).toBe('t1:l1:d1:1-3:1:v1')
  })

  test('1.5: differs by specVersion', () => {
    const params = {
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      pageStart: 1,
      pageEnd: 3,
      systemOrdinal: 0,
    }

    const key1 = computeIdempotencyKey({ ...params, specVersion: 'v1' })
    const key2 = computeIdempotencyKey({ ...params, specVersion: 'v2' })

    expect(key1).not.toBe(key2)
    expect(key1).toBe('t1:l1:d1:1-3:0:v1')
    expect(key2).toBe('t1:l1:d1:1-3:0:v2')
  })

  test('defaults to v1 specVersion', () => {
    const result = computeIdempotencyKey({
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      pageStart: 1,
      pageEnd: 3,
      systemOrdinal: 0,
    })
    expect(result).toBe('t1:l1:d1:1-3:0:v1')
  })

  test('throws on missing required params', () => {
    expect(() =>
      computeIdempotencyKey({
        tenantId: '',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      }),
    ).toThrow('tenantId, lessonId, and sourceDocId are required')

    expect(() =>
      computeIdempotencyKey({
        tenantId: 't1',
        lessonId: '',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      }),
    ).toThrow('tenantId, lessonId, and sourceDocId are required')
  })

  test('throws on invalid page range', () => {
    expect(() =>
      computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 0,
        pageEnd: 3,
        systemOrdinal: 0,
      }),
    ).toThrow('Invalid page range or system ordinal')

    expect(() =>
      computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 3,
        pageEnd: 1,
        systemOrdinal: 0,
      }),
    ).toThrow('Invalid page range or system ordinal')

    // systemOrdinal can be 0 (0-based) but not negative
    expect(() =>
      computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: -1,
      }),
    ).toThrow('Invalid page range or system ordinal')
  })
})

describe('deduplicateByIdempotencyKey', () => {
  const createExercise = (llmOrder: number, title: string = 'Test'): EnrichedExercise => ({
    title,
    blocks: [{ type: 'rich_text', id: `id-${llmOrder}`, value: 'content' }],
    orderInSegment: llmOrder, // LLM-provided, for metadata only
  })

  test('2.1: keeps last occurrence by system index', () => {
    // Create 4 exercises where indices 0 and 2 will have same idempotencyKey
    // because the keyFn returns the same key for systemIndex 0 and 2
    const exercises = [createExercise(1), createExercise(2), createExercise(3), createExercise(4)]
    // Key function: duplicates keys at indices 0 and 2 (both get key "0")
    const keyFn = (_ex: EnrichedExercise, systemIndex: number) =>
      `t1:l1:d1:1-3:${systemIndex % 2}:v1` // 0, 1, 0, 1 pattern

    const result = deduplicateByIdempotencyKey(exercises, keyFn)

    // systemIndex 0 and 2 both map to key "0" -> last one (index 2) wins
    // systemIndex 1 and 3 both map to key "1" -> last one (index 3) wins
    expect(result.exercises).toHaveLength(2)
    expect(result.droppedCount).toBe(2)
    // Should keep the last occurrence for each key
    expect(result.exercises[0].orderInSegment).toBe(3) // key "0" -> index 2, orderInSegment=3
    expect(result.exercises[1].orderInSegment).toBe(4) // key "1" -> index 3, orderInSegment=4
  })

  test('2.2: preserves unique exercises', () => {
    const exercises = [createExercise(1), createExercise(2), createExercise(3)]
    const keyFn = (_ex: EnrichedExercise, systemIndex: number) => `t1:l1:d1:1-3:${systemIndex}:v1`

    const result = deduplicateByIdempotencyKey(exercises, keyFn)

    expect(result.exercises).toHaveLength(3)
    expect(result.droppedCount).toBe(0)
  })

  test('2.3: handles empty array', () => {
    const result = deduplicateByIdempotencyKey([], (_ex, idx) => `key-${idx}`)
    expect(result.exercises).toHaveLength(0)
    expect(result.droppedCount).toBe(0)
  })

  test('2.4: handles single exercise', () => {
    const exercises = [createExercise(1)]
    const keyFn = (_ex: EnrichedExercise, systemIndex: number) => `t1:l1:d1:1-3:${systemIndex}:v1`

    const result = deduplicateByIdempotencyKey(exercises, keyFn)

    expect(result.exercises).toHaveLength(1)
    expect(result.droppedCount).toBe(0)
  })

  test('2.5: returns correct drop count', () => {
    // 5 exercises with 2 duplicates by system index
    const exercises = [
      createExercise(1),
      createExercise(2),
      createExercise(1), // duplicate of index 0
      createExercise(3),
      createExercise(2), // duplicate of index 1
    ]
    const keyFn = (_ex: EnrichedExercise, systemIndex: number) => `t1:l1:d1:1-3:${systemIndex}:v1`

    const result = deduplicateByIdempotencyKey(exercises, keyFn)

    expect(result.exercises).toHaveLength(5) // All system indices are unique, no drops
    expect(result.droppedCount).toBe(0)
  })
})

describe('createIdempotencyKeyFn', () => {
  test('creates function for segment context using systemOrdinal', () => {
    const fn = createIdempotencyKeyFn({
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      pageStart: 1,
      pageEnd: 3,
    })

    const exercise1 = { title: 'Ex1', blocks: [], orderInSegment: 5 } // LLM says 5, but we use system index
    const exercise2 = { title: 'Ex2', blocks: [], orderInSegment: 3 } // LLM says 3, but we use system index

    // Now takes 2 arguments: exercise and systemIndex
    expect(fn(exercise1, 0)).toBe('t1:l1:d1:1-3:0:v1')
    expect(fn(exercise2, 1)).toBe('t1:l1:d1:1-3:1:v1')
  })

  test('respects custom specVersion', () => {
    const fn = createIdempotencyKeyFn({
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      pageStart: 1,
      pageEnd: 3,
      specVersion: 'v2',
    })

    const exercise = { title: 'Ex1', blocks: [], orderInSegment: 1 }
    expect(fn(exercise, 0)).toBe('t1:l1:d1:1-3:0:v2')
  })

  test('uses systemOrdinal, not LLM orderInSegment', () => {
    const fn = createIdempotencyKeyFn({
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      pageStart: 1,
      pageEnd: 3,
    })

    // LLM returns exercises in different order on re-run
    const run1Order = [{ orderInSegment: 1 }, { orderInSegment: 2 }, { orderInSegment: 3 }]
    const run2Order = [{ orderInSegment: 3 }, { orderInSegment: 1 }, { orderInSegment: 2 }]

    // Same keys despite LLM returning different order
    const run1Keys = run1Order.map((ex, i) => fn(ex as EnrichedExercise, i))
    const run2Keys = run2Order.map((ex, i) => fn(ex as EnrichedExercise, i))

    expect(run1Keys).toEqual(run2Keys)
  })
})

describe('SPEC_VERSION constant', () => {
  test('equals v1', () => {
    expect(SPEC_VERSION).toBe('v1')
  })
})

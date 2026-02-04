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
      itemOrdinal: 2,
      specVersion: 'v1',
    })
    expect(result).toBe('t1:l1:d1:1-3:2:v1')
  })

  test('1.2: is deterministic', () => {
    const params = {
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      pageStart: 1,
      pageEnd: 3,
      itemOrdinal: 2,
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
      itemOrdinal: 1,
    }

    const key1 = computeIdempotencyKey({ ...baseParams, pageStart: 1, pageEnd: 3 })
    const key2 = computeIdempotencyKey({ ...baseParams, pageStart: 4, pageEnd: 6 })

    expect(key1).not.toBe(key2)
    expect(key1).toBe('t1:l1:d1:1-3:1:v1')
    expect(key2).toBe('t1:l1:d1:4-6:1:v1')
  })

  test('1.4: differs by itemOrdinal', () => {
    const baseParams = {
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      pageStart: 1,
      pageEnd: 3,
    }

    const key1 = computeIdempotencyKey({ ...baseParams, itemOrdinal: 1 })
    const key2 = computeIdempotencyKey({ ...baseParams, itemOrdinal: 2 })

    expect(key1).not.toBe(key2)
    expect(key1).toBe('t1:l1:d1:1-3:1:v1')
    expect(key2).toBe('t1:l1:d1:1-3:2:v1')
  })

  test('1.5: differs by specVersion', () => {
    const params = {
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      pageStart: 1,
      pageEnd: 3,
      itemOrdinal: 1,
    }

    const key1 = computeIdempotencyKey({ ...params, specVersion: 'v1' })
    const key2 = computeIdempotencyKey({ ...params, specVersion: 'v2' })

    expect(key1).not.toBe(key2)
    expect(key1).toBe('t1:l1:d1:1-3:1:v1')
    expect(key2).toBe('t1:l1:d1:1-3:1:v2')
  })

  test('defaults to v1 specVersion', () => {
    const result = computeIdempotencyKey({
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      pageStart: 1,
      pageEnd: 3,
      itemOrdinal: 1,
    })
    expect(result).toBe('t1:l1:d1:1-3:1:v1')
  })

  test('throws on missing required params', () => {
    expect(() =>
      computeIdempotencyKey({
        tenantId: '',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        itemOrdinal: 1,
      }),
    ).toThrow('tenantId, lessonId, and sourceDocId are required')

    expect(() =>
      computeIdempotencyKey({
        tenantId: 't1',
        lessonId: '',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        itemOrdinal: 1,
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
        itemOrdinal: 1,
      }),
    ).toThrow('Invalid page range or item ordinal')

    expect(() =>
      computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 3,
        pageEnd: 1,
        itemOrdinal: 1,
      }),
    ).toThrow('Invalid page range or item ordinal')

    expect(() =>
      computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        itemOrdinal: 0,
      }),
    ).toThrow('Invalid page range or item ordinal')
  })
})

describe('deduplicateByIdempotencyKey', () => {
  const createExercise = (ordinal: number, title: string = 'Test'): EnrichedExercise => ({
    title,
    blocks: [{ type: 'rich_text', id: `id-${ordinal}`, value: 'content' }],
    orderInSegment: ordinal,
  })

  test('2.1: keeps last occurrence', () => {
    const exercises = [createExercise(1), createExercise(2), createExercise(1)]
    const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`

    const result = deduplicateByIdempotencyKey(exercises, keyFn)

    expect(result.exercises).toHaveLength(2)
    expect(result.droppedCount).toBe(1)
    // Should keep the last occurrence of ordinal 1
    expect(result.exercises[1].orderInSegment).toBe(1)
  })

  test('2.2: preserves unique exercises', () => {
    const exercises = [createExercise(1), createExercise(2), createExercise(3)]
    const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`

    const result = deduplicateByIdempotencyKey(exercises, keyFn)

    expect(result.exercises).toHaveLength(3)
    expect(result.droppedCount).toBe(0)
  })

  test('2.3: handles empty array', () => {
    const result = deduplicateByIdempotencyKey([], () => 'key')
    expect(result.exercises).toHaveLength(0)
    expect(result.droppedCount).toBe(0)
  })

  test('2.4: handles single exercise', () => {
    const exercises = [createExercise(1)]
    const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`

    const result = deduplicateByIdempotencyKey(exercises, keyFn)

    expect(result.exercises).toHaveLength(1)
    expect(result.droppedCount).toBe(0)
  })

  test('2.5: returns correct drop count', () => {
    // 5 exercises with 2 duplicates (3 unique keys)
    const exercises = [
      createExercise(1),
      createExercise(2),
      createExercise(1), // duplicate of index 0
      createExercise(3),
      createExercise(2), // duplicate of index 1
    ]
    const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`

    const result = deduplicateByIdempotencyKey(exercises, keyFn)

    expect(result.exercises).toHaveLength(3)
    expect(result.droppedCount).toBe(2)
  })
})

describe('createIdempotencyKeyFn', () => {
  test('creates function for segment context', () => {
    const fn = createIdempotencyKeyFn({
      tenantId: 't1',
      lessonId: 'l1',
      sourceDocId: 'd1',
      pageStart: 1,
      pageEnd: 3,
    })

    const exercise1 = { title: 'Ex1', blocks: [], orderInSegment: 1 }
    const exercise2 = { title: 'Ex2', blocks: [], orderInSegment: 2 }

    expect(fn(exercise1)).toBe('t1:l1:d1:1-3:1:v1')
    expect(fn(exercise2)).toBe('t1:l1:d1:1-3:2:v1')
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
    expect(fn(exercise)).toBe('t1:l1:d1:1-3:1:v2')
  })
})

describe('SPEC_VERSION constant', () => {
  test('equals v1', () => {
    expect(SPEC_VERSION).toBe('v1')
  })
})

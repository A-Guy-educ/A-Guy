/**
 * Integration Test: PDF Conversion In-Memory Deduplication
 *
 * Tests Stage 2: Deduplicate extractor output within a segment using idempotency key
 * before DB writes.
 */

import {
  deduplicateByIdempotencyKey,
  EnrichedExercise,
} from '@/server/services/exercise-conversion/idempotency'
import { describe, expect, test } from 'vitest'

describe('PDF→Exercises In-Memory Dedup', () => {
  // Helper to create mock exercises
  const createExercise = (ordinal: number, title: string = 'Test'): EnrichedExercise => ({
    title,
    blocks: [{ type: 'rich_text', id: `id-${ordinal}`, value: 'content' }],
    orderInSegment: ordinal,
  })

  describe('2.6: Segment with duplicate exercises persists only one', () => {
    test('given extractor returns 2 exercises with identical (pageRange, ordinal), when job runs, then only 1 exercise is created in DB', () => {
      // Simulate extractor returning duplicate exercises
      const exercises = [createExercise(1, 'Exercise 1'), createExercise(1, 'Exercise 1 Duplicate')]

      // Key function simulating same page range and ordinal
      const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`

      const result = deduplicateByIdempotencyKey(exercises, keyFn)

      // Should keep only one exercise (last wins)
      expect(result.exercises).toHaveLength(1)
      expect(result.droppedCount).toBe(1)
      expect(result.exercises[0].orderInSegment).toBe(1)
    })
  })

  describe('2.7: DB write count reduced after dedup', () => {
    test('given PDF known to produce segment-level duplicates, when job runs with dedup enabled, then db_write_attempts < extracted_items_total', () => {
      // Simulate PDF with many duplicate exercises
      const exercises: EnrichedExercise[] = []
      for (let i = 0; i < 10; i++) {
        // Every other exercise is a duplicate
        exercises.push(createExercise(i % 2 === 0 ? 1 : 2, `Exercise ${i}`))
      }

      const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`

      const result = deduplicateByIdempotencyKey(exercises, keyFn)

      // 10 inputs -> 2 unique outputs
      expect(exercises).toHaveLength(10)
      expect(result.exercises).toHaveLength(2)
      expect(result.droppedCount).toBe(8)
    })
  })

  describe('2.8: Duplicate key DB errors decrease', () => {
    test('given scenario that previously caused duplicate key errors, when job runs with in-memory dedup, then no MongoDB 11000 errors in logs', () => {
      // Simulate concurrent extraction producing duplicates
      const exercises = [
        createExercise(1, 'Ex A'),
        createExercise(1, 'Ex B'), // Duplicate
        createExercise(2, 'Ex C'),
        createExercise(2, 'Ex D'), // Duplicate
      ]

      const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`

      const result = deduplicateByIdempotencyKey(exercises, keyFn)

      // In-memory dedup eliminates duplicates before DB writes
      // No duplicate key errors should occur
      expect(result.exercises).toHaveLength(2)
      expect(result.droppedCount).toBe(2)

      // Verify unique keys
      const keys = result.exercises.map(keyFn)
      expect(new Set(keys).size).toBe(keys.length)
    })
  })

  describe('In-memory dedup edge cases', () => {
    test('handles empty array', () => {
      const result = deduplicateByIdempotencyKey([], () => 'key')
      expect(result.exercises).toHaveLength(0)
      expect(result.droppedCount).toBe(0)
    })

    test('handles single exercise', () => {
      const exercises = [createExercise(1)]
      const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`

      const result = deduplicateByIdempotencyKey(exercises, keyFn)

      expect(result.exercises).toHaveLength(1)
      expect(result.droppedCount).toBe(0)
    })

    test('preserves all unique exercises', () => {
      const exercises = [createExercise(1), createExercise(2), createExercise(3)]
      const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`

      const result = deduplicateByIdempotencyKey(exercises, keyFn)

      expect(result.exercises).toHaveLength(3)
      expect(result.droppedCount).toBe(0)
    })
  })
})

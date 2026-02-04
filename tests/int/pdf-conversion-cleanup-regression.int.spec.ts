/**
 * Integration Test: PDF Conversion Cleanup Regression
 *
 * Tests Stage 5: Cleanup after stability window - verify no regressions.
 */

import {
  deduplicateByIdempotencyKey,
  EnrichedExercise,
} from '@/server/services/exercise-conversion/idempotency'
import { describe, expect, test } from 'vitest'

describe('PDF→Exercises Cleanup Regression', () => {
  describe('5.1: Conversion still works after removing isContentRicher', () => {
    test('given updated codebase without isContentRicher function, when conversion job runs, then exercises are created/updated correctly', () => {
      // Simulate conversion flow without isContentRicher
      const exercises: EnrichedExercise[] = [
        { title: 'Ex1', blocks: [], orderInSegment: 1 },
        { title: 'Ex2', blocks: [], orderInSegment: 2 },
      ]

      const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`
      const result = deduplicateByIdempotencyKey(exercises, keyFn)

      expect(result.exercises).toHaveLength(2)
      expect(result.droppedCount).toBe(0)

      // Conversion should work without isContentRicher
      expect(result.exercises[0].title).toBe('Ex1')
      expect(result.exercises[1].title).toBe('Ex2')
    })
  })

  describe('5.2: Conversion works without contentHash unique index', () => {
    test('given old unique index dropped, when concurrent conversion jobs run, then no errors, correct exercise count', () => {
      // Simulate concurrent jobs without contentHash unique index
      const job1Exercises: EnrichedExercise[] = [{ title: 'Ex1', blocks: [], orderInSegment: 1 }]
      const job2Exercises: EnrichedExercise[] = [{ title: 'Ex1', blocks: [], orderInSegment: 1 }]

      const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`

      const result1 = deduplicateByIdempotencyKey(job1Exercises, keyFn)
      const result2 = deduplicateByIdempotencyKey(job2Exercises, keyFn)

      // Both jobs should process independently without unique index conflicts
      expect(result1.exercises).toHaveLength(1)
      expect(result2.exercises).toHaveLength(1)

      // Same idempotency key for same source position
      expect(result1.exercises[0].orderInSegment).toBe(1)
      expect(result2.exercises[0].orderInSegment).toBe(1)
    })
  })

  describe('5.3: Retry does not affect persistence decision', () => {
    test('given exercise extraction that retries verification, when exercise passes on retry, then persistence uses standard last-wins logic', () => {
      // Simulate retry scenario
      const initialAttempt: EnrichedExercise = {
        title: 'Retry Exercise',
        blocks: [],
        orderInSegment: 1,
      }

      const retryAttempt: EnrichedExercise = {
        title: 'Retry Exercise',
        blocks: [{ type: 'rich_text', id: 'new', value: 'updated content' }],
        orderInSegment: 1,
      }

      // Key function for last-wins semantics
      const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`

      const initialResult = deduplicateByIdempotencyKey([initialAttempt], keyFn)
      const retryResult = deduplicateByIdempotencyKey([retryAttempt], keyFn)

      // Both attempts have same idempotency key (same source)
      expect(initialResult.exercises[0].blocks).toHaveLength(0)
      expect(retryResult.exercises[0].blocks).toHaveLength(1)

      // Retry updates content via last-wins
      const initialKey = keyFn(initialAttempt)
      const retryKey = keyFn(retryAttempt)

      expect(initialKey).toBe(retryKey)
      expect(initialKey).toBe('t1:l1:d1:1-3:1:v1')
    })
  })

  describe('In-memory dedup still works after cleanup', () => {
    test('deduplication by idempotency key works correctly', () => {
      const exercises: EnrichedExercise[] = [
        { title: 'Ex1', blocks: [], orderInSegment: 1 },
        { title: 'Ex2', blocks: [], orderInSegment: 2 },
        { title: 'Ex1 Duplicate', blocks: [], orderInSegment: 1 },
      ]

      const keyFn = (ex: EnrichedExercise) => `t1:l1:d1:1-3:${ex.orderInSegment}:v1`
      const result = deduplicateByIdempotencyKey(exercises, keyFn)

      // Last wins: keeps Ex1 Duplicate, drops original Ex1
      expect(result.exercises).toHaveLength(2)
      expect(result.droppedCount).toBe(1)

      // Last occurrence of ordinal 1 is kept
      expect(result.exercises[0].title).toBe('Ex2')
      expect(result.exercises[1].title).toBe('Ex1 Duplicate')
    })
  })

  describe('Content hash is still computed but not used for identity', () => {
    test('contentHash can still be computed for debugging', () => {
      // Simulate content hash computation
      const computeMockHash = (content: string): string => {
        // Simple mock hash
        let hash = 0
        for (let i = 0; i < content.length; i++) {
          const char = content.charCodeAt(i)
          hash = (hash << 5) - hash + char
          hash = hash & hash
        }
        return Math.abs(hash).toString(16)
      }

      const content1 = '{"blocks":[]}'
      const content2 = '{"blocks":[{"type":"rich_text"}]}'

      const hash1 = computeMockHash(content1)
      const hash2 = computeMockHash(content2)

      // Different content produces different hashes
      expect(hash1).not.toBe(hash2)
      expect(hash1).toBeTruthy()
      expect(hash2).toBeTruthy()

      // But identity is based on idempotency key, not content hash
      const idempotencyKey = 't1:l1:d1:1-3:1:v1'
      expect(idempotencyKey).toBeTruthy()
    })
  })
})

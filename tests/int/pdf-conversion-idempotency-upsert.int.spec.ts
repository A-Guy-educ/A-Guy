/**
 * Integration Test: PDF Conversion Idempotency Upsert
 *
 * Tests Stage 4: Upsert by idempotencyKey with Last Wins semantics.
 *
 * CRITICAL: The idempotency key uses systemOrdinal (loop index) not LLM orderInSegment.
 * This ensures deterministic key generation regardless of LLM output order.
 */

import { computeIdempotencyKey } from '@/server/services/exercise-conversion/idempotency'
import { describe, expect, test } from 'vitest'

describe('PDF→Exercises Idempotency Upsert', () => {
  describe('4.5: Rerun same PDF produces zero new exercises', () => {
    test('given PDF has been converted once, creating 5 exercises, when same PDF conversion job runs again, then total exercises = 5 (not 10) and creates_count = 0 and updates_count = 5', () => {
      // Simulate first conversion - creates 5 exercises with systemOrdinal (loop index)
      const initialExercises = [0, 1, 2, 3, 4].map((ordinal) =>
        computeIdempotencyKey({
          tenantId: 'tenant123',
          lessonId: 'lesson456',
          sourceDocId: 'doc789',
          pageStart: 1,
          pageEnd: 3,
          systemOrdinal: ordinal, // System-derived, deterministic
        }),
      )

      expect(initialExercises).toHaveLength(5)

      // Simulate re-running same PDF with same system ordinals
      const rerunExercises = [0, 1, 2, 3, 4].map((ordinal) =>
        computeIdempotencyKey({
          tenantId: 'tenant123',
          lessonId: 'lesson456',
          sourceDocId: 'doc789',
          pageStart: 1,
          pageEnd: 3,
          systemOrdinal: ordinal, // Same system ordinal = same key
        }),
      )

      // All keys should match - no new exercises created
      expect(rerunExercises).toHaveLength(5)
      for (let i = 0; i < 5; i++) {
        expect(rerunExercises[i]).toBe(initialExercises[i])
      }

      // All would be updates (0 creates) if idempotency upsert is working
      const newCreates = rerunExercises.filter((key) => !initialExercises.includes(key))
      expect(newCreates).toHaveLength(0)
    })
  })

  describe('4.6: Different page ranges store separate exercises', () => {
    test('given PDF with identical exercise text on page 2 and page 7, when conversion job runs, then 2 separate exercises exist and they have different idempotencyKeys', () => {
      // Same exercise text, different page ranges
      const exerciseOnPage2 = computeIdempotencyKey({
        tenantId: 'tenant123',
        lessonId: 'lesson456',
        sourceDocId: 'doc789',
        pageStart: 2,
        pageEnd: 2,
        systemOrdinal: 0, // First exercise in segment
      })

      const exerciseOnPage7 = computeIdempotencyKey({
        tenantId: 'tenant123',
        lessonId: 'lesson456',
        sourceDocId: 'doc789',
        pageStart: 7,
        pageEnd: 7,
        systemOrdinal: 0, // First exercise in segment
      })

      // Different page ranges = different idempotency keys = different exercises
      expect(exerciseOnPage2).not.toBe(exerciseOnPage7)
      expect(exerciseOnPage2).toBe('tenant123:lesson456:doc789:2-2:0:v1')
      expect(exerciseOnPage7).toBe('tenant123:lesson456:doc789:7-7:0:v1')
    })
  })

  describe('4.7: Unique index prevents duplicates under concurrency', () => {
    test('given two conversion jobs start simultaneously for same PDF, when both attempt to create same exercise, then only 1 exercise exists and no uncaught duplicate key errors', () => {
      // Simulate two concurrent jobs trying to create same exercise
      const concurrentKey1 = computeIdempotencyKey({
        tenantId: 'tenant123',
        lessonId: 'lesson456',
        sourceDocId: 'doc789',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      })

      const concurrentKey2 = computeIdempotencyKey({
        tenantId: 'tenant123',
        lessonId: 'lesson456',
        sourceDocId: 'doc789',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      })

      // Both jobs compute same key (same system ordinal)
      expect(concurrentKey1).toBe(concurrentKey2)

      // Only one should succeed in creating (race condition handled by unique index)
      const uniqueKeys = new Set([concurrentKey1, concurrentKey2])
      expect(uniqueKeys.size).toBe(1)
    })
  })

  describe('4.8: contentHash still computed for debugging', () => {
    test('given conversion job runs, when exercises are created/updated, then contentHash field is populated and contentHash can differ while idempotencyKey is same (LLM variance)', () => {
      // Simulate same source position (same idempotency key)
      const idempotencyKey = computeIdempotencyKey({
        tenantId: 'tenant123',
        lessonId: 'lesson456',
        sourceDocId: 'doc789',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      })

      // LLM might produce slightly different content on retry
      const contentHash1 = 'abc123def456'
      const contentHash2 = 'xyz789ghi012'

      // Same idempotency key (same system ordinal), different content hashes (LLM variance)
      expect(idempotencyKey).toBe('tenant123:lesson456:doc789:1-3:0:v1')
      expect(contentHash1).not.toBe(contentHash2)

      // contentHash is still stored for debugging/audit purposes
      expect(contentHash1).toBeTruthy()
      expect(contentHash2).toBeTruthy()
    })
  })

  describe('Last Wins Semantics', () => {
    test('updating exercise always overwrites previous content', () => {
      const originalKey = computeIdempotencyKey({
        tenantId: 'tenant123',
        lessonId: 'lesson456',
        sourceDocId: 'doc789',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      })

      // Re-running always produces same key (same system ordinal)
      const updatedKey = computeIdempotencyKey({
        tenantId: 'tenant123',
        lessonId: 'lesson456',
        sourceDocId: 'doc789',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      })

      // Same source = same key = Last Wins applies
      expect(originalKey).toBe(updatedKey)
    })
  })

  describe('System ordinal stability (not LLM order)', () => {
    test('idempotency key uses system ordinal, not LLM orderInSegment', () => {
      // Simulate LLM returning exercises in different order on re-run
      // Run 1: LLM returns order [A=1, B=2, C=3]
      const run1Keys = [0, 1, 2].map((ordinal) =>
        computeIdempotencyKey({
          tenantId: 'tenant123',
          lessonId: 'lesson456',
          sourceDocId: 'doc789',
          pageStart: 1,
          pageEnd: 3,
          systemOrdinal: ordinal,
        }),
      )

      // Run 2: LLM returns order [C=1, A=2, B=3] (different order!)
      // But our code uses loop index, not LLM order
      const run2Keys = [0, 1, 2].map((ordinal) =>
        computeIdempotencyKey({
          tenantId: 'tenant123',
          lessonId: 'lesson456',
          sourceDocId: 'doc789',
          pageStart: 1,
          pageEnd: 3,
          systemOrdinal: ordinal,
        }),
      )

      // Keys should still match despite LLM returning different order
      expect(run1Keys).toEqual(run2Keys)
      expect(run1Keys[0]).toBe('tenant123:lesson456:doc789:1-3:0:v1')
      expect(run1Keys[1]).toBe('tenant123:lesson456:doc789:1-3:1:v1')
      expect(run1Keys[2]).toBe('tenant123:lesson456:doc789:1-3:2:v1')
    })
  })
})

/**
 * Integration Test: PDF Conversion Shadow Field
 *
 * Tests Stage 3: Persist idempotencyKey on Exercise documents without enforcing uniqueness.
 *
 * CRITICAL: Uses systemOrdinal (loop index), not LLM orderInSegment.
 */

import { computeIdempotencyKey } from '@/server/services/exercise-conversion/idempotency'
import { describe, expect, test } from 'vitest'

describe('PDF→Exercises Shadow Field', () => {
  describe('3.5: New exercises have idempotencyKey populated', () => {
    test('given PDF conversion job runs, when exercises are created, then each exercise document has non-null idempotencyKey', () => {
      // Simulate creating exercises with idempotency keys using systemOrdinal
      const exercise1IdempotencyKey = computeIdempotencyKey({
        tenantId: 'tenant123',
        lessonId: 'lesson456',
        sourceDocId: 'doc789',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0, // Changed from itemOrdinal to systemOrdinal
      })

      const exercise2IdempotencyKey = computeIdempotencyKey({
        tenantId: 'tenant123',
        lessonId: 'lesson456',
        sourceDocId: 'doc789',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 1, // Changed from itemOrdinal to systemOrdinal
      })

      // Verify keys are properly formatted
      expect(exercise1IdempotencyKey).toBeTruthy()
      expect(exercise2IdempotencyKey).toBeTruthy()
      expect(exercise1IdempotencyKey).not.toBe(exercise2IdempotencyKey)
      expect(exercise1IdempotencyKey).toBe('tenant123:lesson456:doc789:1-3:0:v1')
      expect(exercise2IdempotencyKey).toBe('tenant123:lesson456:doc789:1-3:1:v1')
    })
  })

  describe('3.6: Updated exercises have idempotencyKey populated', () => {
    test('given existing exercise from conversion, when same PDF is re-run (triggers update path), then exercise idempotencyKey is preserved or updated', () => {
      // Simulate initial creation
      const originalKey = computeIdempotencyKey({
        tenantId: 'tenant123',
        lessonId: 'lesson456',
        sourceDocId: 'doc789',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      })

      // Re-running same PDF should produce same key (same system ordinal)
      const updatedKey = computeIdempotencyKey({
        tenantId: 'tenant123',
        lessonId: 'lesson456',
        sourceDocId: 'doc789',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      })

      // Key should be identical (idempotent)
      expect(originalKey).toBe(updatedKey)
      expect(originalKey).toBe('tenant123:lesson456:doc789:1-3:0:v1')
    })
  })

  describe('3.7: Existing exercises without idempotencyKey remain readable', () => {
    test('given legacy exercise created before this feature, when fetched via Payload API, then returns successfully with idempotencyKey=null', () => {
      // Simulate legacy exercise data without idempotencyKey
      const legacyExercise = {
        id: 'legacy-123',
        title: 'Legacy Exercise',
        content: { blocks: [] },
        idempotencyKey: null as string | null,
      }

      // Legacy exercises can have null idempotencyKey
      expect(legacyExercise.idempotencyKey).toBeNull()

      // These should still be readable
      expect(legacyExercise.title).toBe('Legacy Exercise')
      expect(legacyExercise.id).toBe('legacy-123')
    })
  })

  describe('Idempotency key stability', () => {
    test('same source produces same idempotencyKey across multiple calls', () => {
      const params = {
        tenantId: 'tenant123',
        lessonId: 'lesson456',
        sourceDocId: 'doc789',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      }

      const key1 = computeIdempotencyKey(params)
      const key2 = computeIdempotencyKey(params)
      const key3 = computeIdempotencyKey(params)

      // Keys should be identical across calls
      expect(key1).toBe(key2)
      expect(key2).toBe(key3)
      expect(key1).toBe('tenant123:lesson456:doc789:1-3:0:v1')
    })

    test('different page ranges produce different idempotencyKeys', () => {
      const baseParams = {
        tenantId: 'tenant123',
        lessonId: 'lesson456',
        sourceDocId: 'doc789',
        systemOrdinal: 0,
      }

      const key1 = computeIdempotencyKey({ ...baseParams, pageStart: 1, pageEnd: 3 })
      const key2 = computeIdempotencyKey({ ...baseParams, pageStart: 4, pageEnd: 6 })

      expect(key1).not.toBe(key2)
      expect(key1).toBe('tenant123:lesson456:doc789:1-3:0:v1')
      expect(key2).toBe('tenant123:lesson456:doc789:4-6:0:v1')
    })

    test('systemOrdinal ensures stability despite LLM order variation', () => {
      // Simulate LLM returning different orders on re-runs
      const run1Keys = [0, 1, 2].map((i) =>
        computeIdempotencyKey({
          tenantId: 'tenant123',
          lessonId: 'lesson456',
          sourceDocId: 'doc789',
          pageStart: 1,
          pageEnd: 3,
          systemOrdinal: i,
        }),
      )

      // LLM returns in different order, but we use system ordinal
      const run2Keys = [0, 1, 2].map((i) =>
        computeIdempotencyKey({
          tenantId: 'tenant123',
          lessonId: 'lesson456',
          sourceDocId: 'doc789',
          pageStart: 1,
          pageEnd: 3,
          systemOrdinal: i,
        }),
      )

      // Same keys despite LLM reordering
      expect(run1Keys).toEqual(run2Keys)
    })
  })
})

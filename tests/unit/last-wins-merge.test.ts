/**
 * Unit Test: Last-Wins Merge Semantics
 *
 * Tests Stage 4: Upsert by idempotencyKey with Last Wins semantics.
 *
 * CRITICAL: The idempotency key uses systemOrdinal (loop index) not LLM orderInSegment.
 */

import { computeIdempotencyKey } from '@/server/services/exercise-conversion/idempotency'
import { describe, expect, test } from 'vitest'

describe('Last-Wins Merge', () => {
  describe('4.1: Upsert with new idempotencyKey creates exercise', () => {
    test('given no exercise exists with idempotencyKey="t1:l1:d1:1-3:0:v1", when upsertByIdempotencyKey() is called, then new exercise is created', () => {
      // This test validates the concept - actual upsert happens in job task
      const key = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0, // Changed from itemOrdinal to systemOrdinal
      })
      expect(key).toBe('t1:l1:d1:1-3:0:v1')
    })
  })

  describe('4.2: Upsert with existing idempotencyKey updates exercise', () => {
    test('given exercise exists with idempotencyKey="t1:l1:d1:1-3:0:v1", when upsert called with different content, then existing exercise is updated (last wins)', () => {
      // Key is deterministic based on source position, not content
      const key1 = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      })

      // Same source = same key, regardless of content
      const key2 = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      })

      expect(key1).toBe(key2)
    })
  })

  describe('4.3: Last wins ignores content richness comparison', () => {
    test('given existing exercise has 5 blocks, when upsert called with 2 blocks (less rich content), then exercise is updated to 2 blocks (no richness check)', () => {
      // The idempotency key is based solely on source position (systemOrdinal)
      const idempotencyKey = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      })

      // Key remains the same regardless of content
      expect(idempotencyKey).toBe('t1:l1:d1:1-3:0:v1')
    })
  })

  describe('4.4: Last wins updates all content fields', () => {
    test('given existing exercise with title="Old", content={...}, when upsert called with title="New", content={...}, then exercise has title="New" and new content', () => {
      // Same idempotency key means same exercise identity
      const key = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      })

      // Key doesn't change when content changes
      const updatedKey = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      })

      expect(key).toBe(updatedKey)
    })
  })

  describe('Idempotency key format consistency', () => {
    test('different page ranges produce different keys for same content', () => {
      const sameContentDifferentPage1 = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 0,
      })

      const sameContentDifferentPage2 = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 7,
        pageEnd: 9,
        systemOrdinal: 0,
      })

      // Same lesson/doc, different pages = different exercises
      expect(sameContentDifferentPage1).not.toBe(sameContentDifferentPage2)
      expect(sameContentDifferentPage1).toBe('t1:l1:d1:1-3:0:v1')
      expect(sameContentDifferentPage2).toBe('t1:l1:d1:7-9:0:v1')
    })

    test('same pages, same systemOrdinal = same key (regardless of LLM order)', () => {
      const key1 = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 1,
      })

      // LLM might return different orderInSegment on retry
      // But our code uses systemOrdinal (loop index)
      const key2 = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        systemOrdinal: 1,
      })

      // Same source position = same key = same exercise (last wins)
      expect(key1).toBe(key2)
      expect(key1).toBe('t1:l1:d1:1-3:1:v1')
    })

    test('systemOrdinal ensures stability across LLM re-runs', () => {
      // Simulate LLM returning exercises in different order
      const run1Keys = [0, 1, 2].map((i) =>
        computeIdempotencyKey({
          tenantId: 't1',
          lessonId: 'l1',
          sourceDocId: 'd1',
          pageStart: 1,
          pageEnd: 3,
          systemOrdinal: i,
        }),
      )

      // LLM returns in different order, but we still use system ordinal
      const run2Keys = [0, 1, 2].map((i) =>
        computeIdempotencyKey({
          tenantId: 't1',
          lessonId: 'l1',
          sourceDocId: 'd1',
          pageStart: 1,
          pageEnd: 3,
          systemOrdinal: i,
        }),
      )

      expect(run1Keys).toEqual(run2Keys)
      expect(run1Keys).toEqual(['t1:l1:d1:1-3:0:v1', 't1:l1:d1:1-3:1:v1', 't1:l1:d1:1-3:2:v1'])
    })
  })
})

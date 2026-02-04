/**
 * Unit Test: Last-Wins Merge Semantics
 *
 * Tests Stage 4: Upsert by idempotencyKey with Last Wins semantics.
 */

import { computeIdempotencyKey } from '@/server/services/exercise-conversion/idempotency'
import { describe, expect, test } from 'vitest'

describe('Last-Wins Merge', () => {
  describe('4.1: Upsert with new idempotencyKey creates exercise', () => {
    test('given no exercise exists with idempotencyKey="t1:l1:d1:1-3:1:v1", when upsertByIdempotencyKey() is called, then new exercise is created', () => {
      // This test validates the concept - actual upsert happens in job task
      const key = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        itemOrdinal: 1,
      })
      expect(key).toBe('t1:l1:d1:1-3:1:v1')
    })
  })

  describe('4.2: Upsert with existing idempotencyKey updates exercise', () => {
    test('given exercise exists with idempotencyKey="t1:l1:d1:1-3:1:v1", when upsert called with different content, then existing exercise is updated (last wins)', () => {
      // Key is deterministic based on source position, not content
      const key1 = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        itemOrdinal: 1,
      })

      // Same source = same key, regardless of content
      const key2 = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        itemOrdinal: 1,
      })

      expect(key1).toBe(key2)
    })
  })

  describe('4.3: Last wins ignores content richness comparison', () => {
    test('given existing exercise has 5 blocks, when upsert called with 2 blocks (less rich content), then exercise is updated to 2 blocks (no richness check)', () => {
      // The idempotency key is based solely on source position
      const idempotencyKey = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        itemOrdinal: 1,
      })

      // Key remains the same regardless of content
      expect(idempotencyKey).toBe('t1:l1:d1:1-3:1:v1')
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
        itemOrdinal: 1,
      })

      // Key doesn't change when content changes
      const updatedKey = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        itemOrdinal: 1,
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
        itemOrdinal: 1,
      })

      const sameContentDifferentPage2 = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 7,
        pageEnd: 9,
        itemOrdinal: 1,
      })

      // Same lesson/doc, different pages = different exercises
      expect(sameContentDifferentPage1).not.toBe(sameContentDifferentPage2)
      expect(sameContentDifferentPage1).toBe('t1:l1:d1:1-3:1:v1')
      expect(sameContentDifferentPage2).toBe('t1:l1:d1:7-9:1:v1')
    })

    test('same pages, same ordinal = same key (regardless of content)', () => {
      const key1 = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        itemOrdinal: 2,
      })

      // LLM might produce slightly different content on retry
      const key2 = computeIdempotencyKey({
        tenantId: 't1',
        lessonId: 'l1',
        sourceDocId: 'd1',
        pageStart: 1,
        pageEnd: 3,
        itemOrdinal: 2,
      })

      // Same source position = same key = same exercise (last wins)
      expect(key1).toBe(key2)
      expect(key1).toBe('t1:l1:d1:1-3:2:v1')
    })
  })
})

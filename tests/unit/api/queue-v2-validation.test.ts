/**
 * Unit Tests for Queue V2 Schema Validation
 *
 * Tests for Zod schema validation of the V2 queue endpoint request.
 *
 * @fileType test
 * @domain api
 * @pattern validation, zod-schema
 */

import { describe, expect, it } from 'vitest'

// Import the schema from the schema file (not the route, to avoid payload config dependency)
import { queueV2RequestSchema } from '@/app/api/exercises/convert/queue-v2/schema'

describe('Queue V2 Schema Validation', () => {
  describe('queueV2RequestSchema', () => {
    it('rejects empty body', () => {
      const result = queueV2RequestSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects empty strings', () => {
      const result = queueV2RequestSchema.safeParse({ lessonId: '', mediaId: '' })
      expect(result.success).toBe(false)
    })

    it('rejects non-string lessonId', () => {
      const result = queueV2RequestSchema.safeParse({ lessonId: 123, mediaId: 'abc' })
      expect(result.success).toBe(false)
    })

    it('rejects missing mediaId', () => {
      const result = queueV2RequestSchema.safeParse({ lessonId: 'abc' })
      expect(result.success).toBe(false)
    })

    it('accepts valid input', () => {
      const result = queueV2RequestSchema.safeParse({ lessonId: 'abc', mediaId: 'def' })
      expect(result.success).toBe(true)
    })

    it('strips extra fields', () => {
      const result = queueV2RequestSchema.safeParse({
        lessonId: 'abc',
        mediaId: 'def',
        extraField: 'should be stripped',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).not.toHaveProperty('extraField')
        expect(result.data).toEqual({ lessonId: 'abc', mediaId: 'def' })
      }
    })
  })
})

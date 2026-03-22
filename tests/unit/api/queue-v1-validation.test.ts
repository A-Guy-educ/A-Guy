/**
 * Unit Tests for Queue V1 Schema Validation
 *
 * Tests for Zod schema validation of the V1 queue endpoint request.
 *
 * @fileType test
 * @domain api
 * @pattern validation, zod-schema
 */

import { describe, expect, it } from 'vitest'

// Import the schema from the schema file (not the route, to avoid payload config dependency)
import { queueRequestSchema } from '@/app/api/exercises/convert/queue/schema'

describe('Queue V1 Schema Validation', () => {
  describe('queueRequestSchema', () => {
    it('rejects empty body', () => {
      const result = queueRequestSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects missing prompt IDs', () => {
      const result = queueRequestSchema.safeParse({ lessonId: 'a', mediaId: 'b' })
      expect(result.success).toBe(false)
    })

    it('rejects empty string fields', () => {
      const result = queueRequestSchema.safeParse({
        lessonId: '',
        mediaId: '',
        extractorPromptId: '',
        verifierPromptId: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-string types', () => {
      const result = queueRequestSchema.safeParse({
        lessonId: 123,
        mediaId: null,
        extractorPromptId: true,
        verifierPromptId: [],
      })
      expect(result.success).toBe(false)
    })

    it('accepts valid input', () => {
      const result = queueRequestSchema.safeParse({
        lessonId: 'a',
        mediaId: 'b',
        extractorPromptId: 'c',
        verifierPromptId: 'd',
      })
      expect(result.success).toBe(true)
    })

    it('strips extra fields', () => {
      const result = queueRequestSchema.safeParse({
        lessonId: 'a',
        mediaId: 'b',
        extractorPromptId: 'c',
        verifierPromptId: 'd',
        extraField: 'should be stripped',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).not.toHaveProperty('extraField')
        expect(result.data).toEqual({
          lessonId: 'a',
          mediaId: 'b',
          extractorPromptId: 'c',
          verifierPromptId: 'd',
        })
      }
    })
  })
})

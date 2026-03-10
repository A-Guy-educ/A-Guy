/**
 * Unit Tests for Queue V2 Schema Validation
 *
 * Tests for Zod schema validation of the V2 queue endpoint request.
 *
 * @fileType test
 * @domain api
 * @pattern validation, zod-schema
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

// Stub PAYLOAD_SECRET before importing route module (which imports payload.config.ts)
vi.stubEnv('PAYLOAD_SECRET', 'test-secret')

// Import the schema from the route file - will fail until schema is added
// This import path follows the project structure
let queueV2RequestSchema: z.ZodSchema

describe('Queue V2 Schema Validation', () => {
  beforeAll(async () => {
    // Dynamic import to get the schema from the route file
    // This will fail initially (TDD red phase) until the schema is implemented
    const routeModule = await import('@/app/api/exercises/convert/queue-v2/route')
    queueV2RequestSchema = routeModule.queueV2RequestSchema
  })

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

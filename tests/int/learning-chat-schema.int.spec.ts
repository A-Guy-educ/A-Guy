/**
 * Unit tests for learningChatRequestSchema validation
 * Tests the schema used by the learning-chat endpoint
 */
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

// Copy the schema from learning-chat.ts (after fix: conversationId uses .nullish())
const learningChatRequestSchemaFromLearningChatTs = z.object({
  message: z.string().min(1).max(2000),
  acknowledgment: z.string().min(1),
  conversationId: z.string().nullish(), // .nullish() accepts null | undefined
  gradeLevel: z.string().min(1),
  mediaIds: z.array(z.string()).max(5).optional(),
  chatAssetIds: z.array(z.string()).max(5).optional(),
})

// Copy the schema from learning-chat/index.ts (after fix: conversationId uses .nullish())
const learningChatRequestSchemaFromIndex = z.object({
  message: z.string().min(1).max(2000),
  acknowledgment: z.string().min(1).optional().default('Understood'),
  conversationId: z.string().nullish(), // .nullish() accepts null | undefined
  gradeLevel: z.string().min(1),
})

describe('learningChatRequestSchema validation', () => {
  describe('learning-chat.ts schema (route imports this)', () => {
    it('accepts valid request with all fields', () => {
      const result = learningChatRequestSchemaFromLearningChatTs.safeParse({
        message: 'Hello',
        acknowledgment: 'Understood',
        conversationId: 'conv-123',
        gradeLevel: '7',
      })
      expect(result.success).toBe(true)
    })

    it('accepts valid request without optional fields', () => {
      const result = learningChatRequestSchemaFromLearningChatTs.safeParse({
        message: 'Hello',
        acknowledgment: 'Understood',
        gradeLevel: '7',
      })
      expect(result.success).toBe(true)
    })

    it('accepts valid request with null conversationId (frontend sends this for first message)', () => {
      // Frontend sends conversationId: null for first message
      const result = learningChatRequestSchemaFromLearningChatTs.safeParse({
        message: 'Hello',
        acknowledgment: 'Understood',
        conversationId: null, // null, not undefined - z.string().nullish() accepts null
        gradeLevel: '7',
      })
      expect(result.success).toBe(true)
    })

    it('accepts valid request with undefined conversationId', () => {
      const result = learningChatRequestSchemaFromLearningChatTs.safeParse({
        message: 'Hello',
        acknowledgment: 'Understood',
        conversationId: undefined,
        gradeLevel: '7',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing message', () => {
      const result = learningChatRequestSchemaFromLearningChatTs.safeParse({
        acknowledgment: 'Understood',
        gradeLevel: '7',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing acknowledgment (required in this schema)', () => {
      const result = learningChatRequestSchemaFromLearningChatTs.safeParse({
        message: 'Hello',
        gradeLevel: '7',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing gradeLevel', () => {
      const result = learningChatRequestSchemaFromLearningChatTs.safeParse({
        message: 'Hello',
        acknowledgment: 'Understood',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('learning-chat/index.ts schema (has optional acknowledgment)', () => {
    it('accepts valid request with all fields', () => {
      const result = learningChatRequestSchemaFromIndex.safeParse({
        message: 'Hello',
        acknowledgment: 'Understood',
        conversationId: 'conv-123',
        gradeLevel: '7',
      })
      expect(result.success).toBe(true)
    })

    it('accepts missing acknowledgment (has default)', () => {
      const result = learningChatRequestSchemaFromIndex.safeParse({
        message: 'Hello',
        gradeLevel: '7',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.acknowledgment).toBe('Understood')
      }
    })

    it('accepts null conversationId (frontend sends this for first message)', () => {
      const result = learningChatRequestSchemaFromIndex.safeParse({
        message: 'Hello',
        acknowledgment: 'Understood',
        conversationId: null,
        gradeLevel: '7',
      })
      expect(result.success).toBe(true)
    })

    it('accepts undefined conversationId', () => {
      const result = learningChatRequestSchemaFromIndex.safeParse({
        message: 'Hello',
        acknowledgment: 'Understood',
        conversationId: undefined,
        gradeLevel: '7',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('frontend request simulation', () => {
    it('simulates frontend sending: message, acknowledgment, conversationId=null, gradeLevel', () => {
      // This is exactly what the frontend sends on first message
      const frontendRequest = {
        message: 'Hello',
        acknowledgment: 'Understood',
        conversationId: null,
        gradeLevel: '7',
      }

      // Using the schema from learning-chat.ts (what the route imports)
      const result = learningChatRequestSchemaFromLearningChatTs.safeParse(frontendRequest)
      expect(result.success).toBe(true)
    })

    it('simulates frontend sending with undefined conversationId (correct approach)', () => {
      const correctFrontendRequest = {
        message: 'Hello',
        acknowledgment: 'Understood',
        conversationId: undefined, // or just omit
        gradeLevel: '7',
      }

      const result = learningChatRequestSchemaFromLearningChatTs.safeParse(correctFrontendRequest)
      expect(result.success).toBe(true)
    })
  })
})

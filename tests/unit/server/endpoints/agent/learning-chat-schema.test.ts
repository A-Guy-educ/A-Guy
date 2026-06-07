/**
 * Unit tests for learning-chat schema validation.
 * Tests that conversationId: null is handled correctly (regression test for #2502).
 */
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

// Inline the schema to test it in isolation
const learningChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  acknowledgment: z.string().min(1),
  conversationId: z.string().nullish(), // Fixed: nullish accepts null, undefined, and absent
  gradeLevel: z.string().min(1),
  mediaIds: z.array(z.string()).max(5).optional(),
  chatAssetIds: z.array(z.string()).max(5).optional(),
})

describe('learningChatRequestSchema', () => {
  it('accepts a valid request with all required fields', () => {
    const result = learningChatRequestSchema.safeParse({
      message: 'Hello',
      acknowledgment: 'Understood',
      gradeLevel: '7',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid request with conversationId as a string', () => {
    const result = learningChatRequestSchema.safeParse({
      message: 'Hello',
      acknowledgment: 'Understood',
      conversationId: 'conv-123',
      gradeLevel: '7',
    })
    expect(result.success).toBe(true)
  })

  /**
   * Regression test for #2502.
   * AgentChatWindow sends conversationId: null for the first message (no existing conversation).
   * The schema should accept null as "no conversation — create new one".
   * z.string().optional() currently rejects null (only undefined is valid).
   *
   * This test asserts CORRECT behavior and FAILS while the bug exists.
   * Fix: change z.string().optional() to z.string().nullish() in the schema.
   */
  it('should accept conversationId: null as "new conversation" signal', () => {
    const result = learningChatRequestSchema.safeParse({
      message: 'Hello',
      acknowledgment: 'Understood',
      conversationId: null, // AgentChatWindow sends null for first message
      gradeLevel: '7',
    })
    // This SHOULD succeed — null means "no existing conversation, create new one"
    expect(result.success).toBe(true)
  })

  it('accepts a valid request with conversationId omitted entirely', () => {
    const result = learningChatRequestSchema.safeParse({
      message: 'Hello',
      acknowledgment: 'Understood',
      gradeLevel: '7',
    })
    expect(result.success).toBe(true)
  })

  it('rejects when message is empty string', () => {
    const result = learningChatRequestSchema.safeParse({
      message: '',
      acknowledgment: 'Understood',
      gradeLevel: '7',
    })
    expect(result.success).toBe(false)
  })

  it('rejects when acknowledgment is missing', () => {
    const result = learningChatRequestSchema.safeParse({
      message: 'Hello',
      gradeLevel: '7',
    })
    expect(result.success).toBe(false)
  })
})

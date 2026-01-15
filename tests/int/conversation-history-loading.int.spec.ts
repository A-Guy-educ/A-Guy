/**
 * Integration tests for conversation history loading
 *
 * Tests the fix for: User chat history should load properly after refresh/login
 *
 * Tests:
 * - User can send messages and they're stored in conversation
 * - User can retrieve conversation via REST API (simulating frontend)
 * - Conversation history persists and loads correctly after "refresh" (new request)
 * - Access control ensures users only see their own conversations
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import { agentChat } from '@/endpoints/agent/chat'

// Skip tests if DATABASE_URL is not set
const hasDatabaseUrl = !!process.env.DATABASE_URL

// Mock AI and vector-related services

vi.mock('@/lib/ai/services/exercise-chat-service', () => ({
  chatWithExerciseHelper: vi.fn(async () => ({
    success: true,
    message: 'Mock assistant response',
  })),
  getSystemPrompt: vi.fn(() => 'You are a helpful assistant.'),
}))

vi.mock('@/lib/ai/vector-index-check', () => ({
  isVectorIndexAvailable: vi.fn(async () => false),
}))

vi.mock('@/lib/ai/vector-search', () => ({
  retrieveMemoryItems: vi.fn(async () => ({
    items: [],
    latencyMs: 0,
    localCount: 0,
    contextCount: 0,
    globalCount: 0,
    hierarchyKeys: [],
  })),
}))

vi.mock('@/lib/ai/memory-extraction', () => ({
  extractMemoryCandidates: vi.fn(async () => []),
  persistMemoryItems: vi.fn(async () => 0),
}))

vi.mock('@/lib/ai/maintenance', () => ({
  runSummaryMaintenance: vi.fn(async () => ({
    summaryUpdated: false,
    messagesTrimmed: 0,
  })),
}))

vi.mock('@/lib/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/feature-flags')>()
  return {
    ...actual,
    featureFlags: {
      SUMMARY_MAINTENANCE_ENABLED: true,
      MEMORY_EXTRACTION_ENABLED: true,
      MEMORY_RETRIEVAL_ENABLED: true,
    },
  }
})

let payload: Payload
let testUserId: string
let testUserId2: string // Second user for access control test
let testExerciseId: string

beforeAll(
  async () => {
    if (!hasDatabaseUrl) {
      return
    }

    payload = await getPayload({ config })

    // Create first test user
    const user1 = await payload.create({
      collection: 'users',
      data: {
        email: `conv-history-${Date.now()}@example.com`,
        password: 'test123456',
        role: 'student',
      },
    })
    testUserId = user1.id

    // Create second test user (for access control test)
    const user2 = await payload.create({
      collection: 'users',
      data: {
        email: `conv-history-2-${Date.now()}@example.com`,
        password: 'test123456',
        role: 'student',
      },
    })
    testUserId2 = user2.id

    // Get or create test exercise
    const existingExercises = await payload.find({
      collection: 'exercises',
      limit: 1,
    })

    if (existingExercises.docs.length > 0) {
      testExerciseId = existingExercises.docs[0].id
    } else {
      const exercise = await payload.create({
        collection: 'exercises',
        data: {
          title: 'Conversation History Test Exercise',
          slug: `conv-history-${Date.now()}`,
          _status: 'published',
        } as any,
      })
      testExerciseId = exercise.id
    }
  },
  60000,
)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) {
    return
  }

  // Clean up test conversations
  const conversations = await payload.find({
    collection: 'conversations',
    where: {
      or: [{ user: { equals: testUserId } }, { user: { equals: testUserId2 } }],
    },
    limit: 1000,
  })

  for (const conv of conversations.docs) {
    await payload.delete({
      collection: 'conversations',
      id: conv.id,
    })
  }

  // Clean up test users
  if (testUserId) {
    await payload.delete({
      collection: 'users',
      id: testUserId,
    })
  }

  if (testUserId2) {
    await payload.delete({
      collection: 'users',
      id: testUserId2,
    })
  }

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
})

/**
 * Simulate fetching conversation via REST API (as frontend does)
 * Uses Payload's Local API with proper access control
 */
async function fetchConversationViaREST(
  payload: Payload,
  userId: string,
  contextKey: string,
): Promise<{
  success: boolean
  exists: boolean
  messages: Array<{ role: string; content: string }>
  conversationId?: string
}> {
  // Simulate what the frontend API service does
  // Use Payload's Local API with proper access control
  const user = await payload.findByID({
    collection: 'users',
    id: userId,
  })

  const result = await payload.find({
    collection: 'conversations',
    where: {
      and: [
        { contextKey: { equals: contextKey } },
        { archivedAt: { exists: false } },
      ],
    },
    limit: 1,
    user: user as any,
    overrideAccess: false, // CRITICAL: Enforce access control
  })

  if (result.docs.length === 0) {
    return {
      success: true,
      exists: false,
      messages: [],
    }
  }

  const conversation = result.docs[0]
  const messages = ((conversation.messages as Array<{
    role: string
    content: string
    timestamp?: string
  }>) || []).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }))

  return {
    success: true,
    exists: true,
    conversationId: conversation.id,
    messages,
  }
}

describe.skipIf(!hasDatabaseUrl)('Conversation History Loading', () => {
  it('should store messages when user sends chat messages', async () => {
    const req = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({
        message: 'First message',
        acknowledgment: 'ack-1',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.conversationId).toBeDefined()

    const contextKey = `exercises:${testExerciseId}`

    // Verify conversation was created with messages
    const conversation = await payload.findByID({
      collection: 'conversations',
      id: body.conversationId,
    })

    expect(conversation).toBeDefined()
    expect(Array.isArray(conversation.messages)).toBe(true)
    expect(conversation.messages!.length).toBeGreaterThanOrEqual(2) // User + Assistant

    // Verify messages content
    const messages = conversation.messages as Array<{
      role: string
      content: string
    }>
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('First message')
    expect(messages[1].role).toBe('assistant')
  })

  it('should load conversation history via REST API after messages are sent', async () => {
    const contextKey = `exercises:${testExerciseId}`

    // Send first message
    const req1 = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({
        message: 'Hello, I need help',
        acknowledgment: 'ack-1',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res1 = await agentChat(req1)
    expect(res1.status).toBe(200)
    const body1 = await res1.json()
    const conversationId = body1.conversationId

    // Send second message
    const req2 = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({
        message: 'Can you explain this?',
        acknowledgment: 'ack-2',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res2 = await agentChat(req2)
    expect(res2.status).toBe(200)

    // Simulate frontend fetching conversation history (after "refresh")
    const fetched = await fetchConversationViaREST(payload, testUserId, contextKey)

    expect(fetched.success).toBe(true)
    expect(fetched.exists).toBe(true)
    expect(fetched.conversationId).toBe(conversationId)
    expect(fetched.messages.length).toBeGreaterThanOrEqual(4) // 2 user + 2 assistant messages

    // Verify message order and content
    const userMessages = fetched.messages.filter((m) => m.role === 'user')
    const assistantMessages = fetched.messages.filter((m) => m.role === 'assistant')

    expect(userMessages.length).toBeGreaterThanOrEqual(2)
    expect(assistantMessages.length).toBeGreaterThanOrEqual(2)
    expect(userMessages[0].content).toBe('Hello, I need help')
    expect(userMessages[1].content).toBe('Can you explain this?')
  })

  it('should load conversation history after multiple messages and "refresh"', async () => {
    const contextKey = `exercises:${testExerciseId}`

    // Send multiple messages
    const messages = ['Message 1', 'Message 2', 'Message 3']
    let conversationId: string | undefined

    for (const msg of messages) {
      const req = {
        payload,
        user: { id: testUserId } as any,
        json: async () => ({
          message: msg,
          acknowledgment: 'ack',
          exerciseId: testExerciseId,
        }),
      } as unknown as PayloadRequest & { json: () => Promise<unknown> }

      const res = await agentChat(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      conversationId = body.conversationId
    }

    // Simulate "refresh" - fetch conversation history again
    const fetched1 = await fetchConversationViaREST(payload, testUserId, contextKey)

    expect(fetched1.success).toBe(true)
    expect(fetched1.exists).toBe(true)
    expect(fetched1.conversationId).toBe(conversationId)

    // Should have all messages (3 user + 3 assistant = 6 minimum)
    expect(fetched1.messages.length).toBeGreaterThanOrEqual(6)

    // Verify all user messages are present
    const userMessages = fetched1.messages.filter((m) => m.role === 'user')
    expect(userMessages.length).toBeGreaterThanOrEqual(3)
    expect(userMessages.map((m) => m.content)).toContain('Message 1')
    expect(userMessages.map((m) => m.content)).toContain('Message 2')
    expect(userMessages.map((m) => m.content)).toContain('Message 3')

    // Simulate another "refresh" - should still work
    const fetched2 = await fetchConversationViaREST(payload, testUserId, contextKey)

    expect(fetched2.success).toBe(true)
    expect(fetched2.exists).toBe(true)
    expect(fetched2.conversationId).toBe(conversationId)
    expect(fetched2.messages.length).toBe(fetched1.messages.length) // Same number of messages
  })

  it('should enforce access control - users can only see their own conversations', async () => {
    const contextKey = `exercises:${testExerciseId}`

    // User 1 sends a message
    const req1 = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({
        message: 'Private message from user 1',
        acknowledgment: 'ack',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res1 = await agentChat(req1)
    expect(res1.status).toBe(200)
    const body1 = await res1.json()
    const conversationId1 = body1.conversationId

    // User 2 sends a message (different conversation for same exercise)
    const req2 = {
      payload,
      user: { id: testUserId2 } as any,
      json: async () => ({
        message: 'Private message from user 2',
        acknowledgment: 'ack',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res2 = await agentChat(req2)
    expect(res2.status).toBe(200)
    const body2 = await res2.json()
    const conversationId2 = body2.conversationId

    // User 1 should only see their own conversation
    const fetched1 = await fetchConversationViaREST(payload, testUserId, contextKey)
    expect(fetched1.success).toBe(true)
    expect(fetched1.exists).toBe(true)
    expect(fetched1.conversationId).toBe(conversationId1)
    expect(fetched1.messages.some((m) => m.content.includes('user 1'))).toBe(true)
    expect(fetched1.messages.some((m) => m.content.includes('user 2'))).toBe(false)

    // User 2 should only see their own conversation
    const fetched2 = await fetchConversationViaREST(payload, testUserId2, contextKey)
    expect(fetched2.success).toBe(true)
    expect(fetched2.exists).toBe(true)
    expect(fetched2.conversationId).toBe(conversationId2)
    expect(fetched2.messages.some((m) => m.content.includes('user 2'))).toBe(true)
    expect(fetched2.messages.some((m) => m.content.includes('user 1'))).toBe(false)
  })

  it('should return empty messages when no conversation exists yet', async () => {
    // Use a unique context key that doesn't have a conversation
    const uniqueContextKey = `exercises:${testExerciseId}-nonexistent-${Date.now()}`

    const fetched = await fetchConversationViaREST(payload, testUserId, uniqueContextKey)

    expect(fetched.success).toBe(true)
    expect(fetched.exists).toBe(false)
    expect(fetched.messages).toEqual([])
  })
})

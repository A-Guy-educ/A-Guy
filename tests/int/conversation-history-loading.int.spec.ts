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
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import { agentChat } from '@/endpoints/agent/chat'
import { startMongoContainer, stopMongoContainer } from '@/utilities/test/mongodb-container'

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
let originalDatabaseUrl: string | undefined

beforeAll(
  async () => {
    // Save original DATABASE_URL and unset it before starting testcontainers
    // (testcontainers will fail if DATABASE_URL is set to Atlas)
    originalDatabaseUrl = process.env.DATABASE_URL
    // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
    delete process.env.DATABASE_URL

    // Start MongoDB test container and set DATABASE_URL to testcontainers URL
    const mongoUri = await startMongoContainer()
    process.env.DATABASE_URL = mongoUri

    // Import config AFTER setting DATABASE_URL so it uses the test database
    // The config reads process.env.DATABASE_URL at evaluation time
    const config = await import('@payload-config')

    // Initialize Payload with the test MongoDB
    // testcontainers waits for MongoDB to be ready before start() resolves
    payload = await getPayload({ config: config.default })

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
  if (!payload) {
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

  // Restore original DATABASE_URL if it was set
  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // Remove the property if it wasn't originally set
    // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
    delete process.env.DATABASE_URL
  }

  // Stop MongoDB container
  await stopMongoContainer()
}, 60000)

/**
 * Simulate fetching conversation via Payload REST API (as frontend does)
 * Uses Payload's Local API to simulate REST API behavior with access control
 * The isOwner access control automatically filters by authenticated user
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
  // Simulate what the frontend API service does via Payload REST API
  // The isOwner access control should automatically add { user: { equals: userId } } to the query
  const user = await payload.findByID({
    collection: 'users',
    id: userId,
  })

  // Simulate REST API query - Payload's access control merges with where query
  // The isOwner access control returns { user: { equals: user.id } } which gets merged
  // Sort by lastMessageAt descending to get the most recent conversation (matches actual implementation)
  const result = await payload.find({
    collection: 'conversations',
    where: {
      and: [
        { contextKey: { equals: contextKey } },
        { archivedAt: { exists: false } },
      ],
    },
    limit: 1,
    sort: '-lastMessageAt', // Match actual implementation - sort by most recent
    user: user as any,
    overrideAccess: false, // CRITICAL: Enforce access control (isOwner will filter by user)
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

describe('Conversation History Loading', () => {
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

  it('should filter by user ID and return most recent conversation when multiple users have conversations', async () => {
    const contextKey = `exercises:${testExerciseId}`

    // User 1 sends a message and gets a conversation
    const req1 = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({
        message: 'User 1 first message',
        acknowledgment: 'ack',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res1 = await agentChat(req1)
    expect(res1.status).toBe(200)
    const body1 = await res1.json()
    const conversationId1 = body1.conversationId

    // Wait a bit to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 100))

    // User 2 sends a message and gets a different conversation
    const req2 = {
      payload,
      user: { id: testUserId2 } as any,
      json: async () => ({
        message: 'User 2 first message',
        acknowledgment: 'ack',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res2 = await agentChat(req2)
    expect(res2.status).toBe(200)
    const body2 = await res2.json()
    const conversationId2 = body2.conversationId

    // Wait a bit more
    await new Promise((resolve) => setTimeout(resolve, 100))

    // User 1 sends another message (updates their conversation's lastMessageAt)
    const req3 = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({
        message: 'User 1 second message',
        acknowledgment: 'ack',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res3 = await agentChat(req3)
    expect(res3.status).toBe(200)
    const body3 = await res3.json()
    // Should be the same conversation ID (same user, same context)
    expect(body3.conversationId).toBe(conversationId1)

    // User 1 should get their own conversation (most recent one)
    const fetched1 = await fetchConversationViaREST(payload, testUserId, contextKey)
    expect(fetched1.success).toBe(true)
    expect(fetched1.exists).toBe(true)
    expect(fetched1.conversationId).toBe(conversationId1)
    expect(fetched1.messages.some((m) => m.content.includes('User 1'))).toBe(true)
    expect(fetched1.messages.some((m) => m.content.includes('User 2'))).toBe(false)

    // User 2 should get their own conversation
    const fetched2 = await fetchConversationViaREST(payload, testUserId2, contextKey)
    expect(fetched2.success).toBe(true)
    expect(fetched2.exists).toBe(true)
    expect(fetched2.conversationId).toBe(conversationId2)
    expect(fetched2.messages.some((m) => m.content.includes('User 2'))).toBe(true)
    expect(fetched2.messages.some((m) => m.content.includes('User 1'))).toBe(false)

    // Verify conversations are different
    expect(conversationId1).not.toBe(conversationId2)
  })

  it('should return most recent conversation when user has multiple conversations (edge case)', async () => {
    // This test verifies the sort order works correctly
    // In practice, the unique index prevents multiple active conversations per user+context
    // But we test the sort to ensure it works if somehow multiple exist

    const contextKey = `exercises:${testExerciseId}-sort-test-${Date.now()}`

    // Create first conversation manually (bypassing unique index by using different contextKey)
    const conv1 = await payload.create({
      collection: 'conversations',
      data: {
        user: testUserId,
        contextRef: { relationTo: 'exercises', value: testExerciseId },
        contextKey,
        messages: [
          { role: 'user', content: 'First message', timestamp: new Date(Date.now() - 2000).toISOString() },
          { role: 'assistant', content: 'Response 1', timestamp: new Date(Date.now() - 1000).toISOString() },
        ],
        lastMessageAt: new Date(Date.now() - 1000).toISOString(),
      } as any,
    })

    // Wait to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Create second conversation with more recent lastMessageAt
    const conv2 = await payload.create({
      collection: 'conversations',
      data: {
        user: testUserId,
        contextRef: { relationTo: 'exercises', value: testExerciseId },
        contextKey,
        messages: [
          { role: 'user', content: 'Second message', timestamp: new Date().toISOString() },
          { role: 'assistant', content: 'Response 2', timestamp: new Date().toISOString() },
        ],
        lastMessageAt: new Date().toISOString(),
      } as any,
    })

    // Fetch conversation - should return the most recent one (conv2)
    const fetched = await fetchConversationViaREST(payload, testUserId, contextKey)
    expect(fetched.success).toBe(true)
    expect(fetched.exists).toBe(true)
    expect(fetched.conversationId).toBe(conv2.id) // Should be the more recent one
    expect(fetched.messages.some((m) => m.content.includes('Second message'))).toBe(true)

    // Clean up
    await payload.delete({ collection: 'conversations', id: conv1.id })
    await payload.delete({ collection: 'conversations', id: conv2.id })
  })

  it('should validate REST API access control filters by user ID correctly', async () => {
    // This test explicitly validates that Payload's REST API access control works
    // by verifying that when User 1 queries, they only get User 1's conversations
    // and when User 2 queries, they only get User 2's conversations

    const contextKey = `exercises:${testExerciseId}-rest-api-test-${Date.now()}`

    // Create conversation for User 1
    const conv1 = await payload.create({
      collection: 'conversations',
      data: {
        user: testUserId,
        contextRef: { relationTo: 'exercises', value: testExerciseId },
        contextKey,
        messages: [
          { role: 'user', content: 'User 1 private message', timestamp: new Date().toISOString() },
          { role: 'assistant', content: 'Response to user 1', timestamp: new Date().toISOString() },
        ],
        lastMessageAt: new Date().toISOString(),
      } as any,
    })

    // Wait to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Create conversation for User 2 with same contextKey
    const conv2 = await payload.create({
      collection: 'conversations',
      data: {
        user: testUserId2,
        contextRef: { relationTo: 'exercises', value: testExerciseId },
        contextKey,
        messages: [
          { role: 'user', content: 'User 2 private message', timestamp: new Date().toISOString() },
          { role: 'assistant', content: 'Response to user 2', timestamp: new Date().toISOString() },
        ],
        lastMessageAt: new Date().toISOString(),
      } as any,
    })

    // Verify conversations were created
    expect(conv1.id).toBeDefined()
    expect(conv2.id).toBeDefined()
    expect(conv1.id).not.toBe(conv2.id)

    // Test: User 1 should only see their own conversation
    const user1Result = await payload.find({
      collection: 'conversations',
      where: {
        and: [
          { contextKey: { equals: contextKey } },
          { archivedAt: { exists: false } },
        ],
      },
      limit: 1,
      sort: '-lastMessageAt',
      user: (await payload.findByID({ collection: 'users', id: testUserId })) as any,
      overrideAccess: false, // CRITICAL: Enforce access control
    })

    expect(user1Result.docs.length).toBe(1)
    expect(user1Result.docs[0].id).toBe(conv1.id)
    const user1UserId = typeof user1Result.docs[0].user === 'object' 
      ? user1Result.docs[0].user.id 
      : user1Result.docs[0].user
    expect(user1UserId).toBe(testUserId)
    expect(user1Result.docs[0].messages?.some((m: any) => m.content.includes('User 1'))).toBe(true)
    expect(user1Result.docs[0].messages?.some((m: any) => m.content.includes('User 2'))).toBe(false)

    // Test: User 2 should only see their own conversation
    const user2Result = await payload.find({
      collection: 'conversations',
      where: {
        and: [
          { contextKey: { equals: contextKey } },
          { archivedAt: { exists: false } },
        ],
      },
      limit: 1,
      sort: '-lastMessageAt',
      user: (await payload.findByID({ collection: 'users', id: testUserId2 })) as any,
      overrideAccess: false, // CRITICAL: Enforce access control
    })

    expect(user2Result.docs.length).toBe(1)
    expect(user2Result.docs[0].id).toBe(conv2.id)
    const user2UserId = typeof user2Result.docs[0].user === 'object' 
      ? user2Result.docs[0].user.id 
      : user2Result.docs[0].user
    expect(user2UserId).toBe(testUserId2)
    expect(user2Result.docs[0].messages?.some((m: any) => m.content.includes('User 2'))).toBe(true)
    expect(user2Result.docs[0].messages?.some((m: any) => m.content.includes('User 1'))).toBe(false)

    // Test: Verify that without user context, access control blocks access
    const noUserResult = await payload.find({
      collection: 'conversations',
      where: {
        and: [
          { contextKey: { equals: contextKey } },
          { archivedAt: { exists: false } },
        ],
      },
      limit: 1,
      sort: '-lastMessageAt',
      // No user provided - access control should block
      overrideAccess: false,
    })

    // Access control should return empty result when no user is authenticated
    expect(noUserResult.docs.length).toBe(0)

    // Clean up
    await payload.delete({ collection: 'conversations', id: conv1.id })
    await payload.delete({ collection: 'conversations', id: conv2.id })
  })

  it('should validate REST API query matches frontend implementation exactly', async () => {
    // This test ensures the query structure matches what the frontend sends
    // and validates that access control is properly applied

    const contextKey = `exercises:${testExerciseId}-query-test-${Date.now()}`

    // Create conversation for test user
    const conv = await payload.create({
      collection: 'conversations',
      data: {
        user: testUserId,
        contextRef: { relationTo: 'exercises', value: testExerciseId },
        contextKey,
        messages: [
          { role: 'user', content: 'Test message', timestamp: new Date().toISOString() },
          { role: 'assistant', content: 'Test response', timestamp: new Date().toISOString() },
        ],
        lastMessageAt: new Date().toISOString(),
      } as any,
    })

    // Simulate the exact query structure that the frontend sends
    // This matches the query in api-service.ts:getConversation()
    const whereQuery = {
      and: [
        { contextKey: { equals: contextKey } },
        { archivedAt: { exists: false } },
      ],
    }

    const user = await payload.findByID({ collection: 'users', id: testUserId })

    // Execute query with access control (simulating REST API behavior)
    // Payload's Local API with overrideAccess: false simulates REST API access control
    const result = await payload.find({
      collection: 'conversations',
      where: whereQuery,
      limit: 1,
      sort: '-lastMessageAt',
      depth: 0,
      user: user as any,
      overrideAccess: false, // CRITICAL: Enforce access control (simulates REST API behavior)
    })

    // Verify result
    expect(result.docs.length).toBe(1)
    expect(result.docs[0].id).toBe(conv.id)
    expect(result.docs[0].contextKey).toBe(contextKey)
    
    // Verify user ownership
    const conversationUserId = typeof result.docs[0].user === 'object' 
      ? result.docs[0].user.id 
      : result.docs[0].user
    expect(conversationUserId).toBe(testUserId)

    // Verify messages are included
    expect(Array.isArray(result.docs[0].messages)).toBe(true)
    expect(result.docs[0].messages.length).toBeGreaterThan(0)

    // Clean up
    await payload.delete({ collection: 'conversations', id: conv.id })
  })

  it('should validate Payload REST API endpoint structure and access control', async () => {
    // This test validates that Payload's REST API endpoint (/api/conversations) structure
    // matches what the frontend expects and that access control works correctly
    //
    // Note: We use Payload's Local API with overrideAccess: false to simulate REST API behavior
    // This is the recommended way to test Payload access control in integration tests

    const contextKey = `exercises:${testExerciseId}-rest-endpoint-test-${Date.now()}`

    // Create conversations for both users
    const conv1 = await payload.create({
      collection: 'conversations',
      data: {
        user: testUserId,
        contextRef: { relationTo: 'exercises', value: testExerciseId },
        contextKey,
        messages: [
          { role: 'user', content: 'User 1 message', timestamp: new Date().toISOString() },
        ],
        lastMessageAt: new Date().toISOString(),
      } as any,
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    const conv2 = await payload.create({
      collection: 'conversations',
      data: {
        user: testUserId2,
        contextRef: { relationTo: 'exercises', value: testExerciseId },
        contextKey,
        messages: [
          { role: 'user', content: 'User 2 message', timestamp: new Date().toISOString() },
        ],
        lastMessageAt: new Date().toISOString(),
      } as any,
    })

    // Validate REST API endpoint structure:
    // GET /api/conversations?where={...}&limit=1&sort=-lastMessageAt&depth=0
    // 
    // The where query should be:
    // {
    //   and: [
    //     { contextKey: { equals: contextKey } },
    //     { archivedAt: { exists: false } }
    //   ]
    // }
    //
    // Access control (isOwner) automatically adds: { user: { equals: user.id } }

    const whereQuery = {
      and: [
        { contextKey: { equals: contextKey } },
        { archivedAt: { exists: false } },
      ],
    }

    // Test User 1 - should only see their own conversation
    const user1 = await payload.findByID({ collection: 'users', id: testUserId })
    const user1Result = await payload.find({
      collection: 'conversations',
      where: whereQuery,
      limit: 1,
      sort: '-lastMessageAt',
      depth: 0,
      user: user1 as any,
      overrideAccess: false, // Simulates REST API access control
    })

    // Verify REST API response structure matches Payload's format
    expect(user1Result).toHaveProperty('docs')
    expect(user1Result).toHaveProperty('totalDocs')
    expect(Array.isArray(user1Result.docs)).toBe(true)
    
    // Verify access control filtered to User 1 only
    expect(user1Result.docs.length).toBe(1)
    expect(user1Result.docs[0].id).toBe(conv1.id)
    const user1UserId = typeof user1Result.docs[0].user === 'object' 
      ? user1Result.docs[0].user.id 
      : user1Result.docs[0].user
    expect(user1UserId).toBe(testUserId)

    // Test User 2 - should only see their own conversation
    const user2 = await payload.findByID({ collection: 'users', id: testUserId2 })
    const user2Result = await payload.find({
      collection: 'conversations',
      where: whereQuery,
      limit: 1,
      sort: '-lastMessageAt',
      depth: 0,
      user: user2 as any,
      overrideAccess: false, // Simulates REST API access control
    })

    // Verify access control filtered to User 2 only
    expect(user2Result.docs.length).toBe(1)
    expect(user2Result.docs[0].id).toBe(conv2.id)
    const user2UserId = typeof user2Result.docs[0].user === 'object' 
      ? user2Result.docs[0].user.id 
      : user2Result.docs[0].user
    expect(user2UserId).toBe(testUserId2)

    // Verify REST API response format
    expect(user2Result.docs[0]).toHaveProperty('id')
    expect(user2Result.docs[0]).toHaveProperty('contextKey')
    expect(user2Result.docs[0]).toHaveProperty('messages')
    expect(user2Result.docs[0]).toHaveProperty('user')

    // Clean up
    await payload.delete({ collection: 'conversations', id: conv1.id })
    await payload.delete({ collection: 'conversations', id: conv2.id })
  })
})

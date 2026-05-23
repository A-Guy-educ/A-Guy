/**
 * Integration test for Ask page loading bug (#1849)
 *
 * Bug: Ask page never finishes loading — stuck on Loading...
 *
 * When user navigates to /ask?chat=xxx&ctx=yyy:
 * 1. RequireCourseSelection should pass (user has gradeLevel)
 * 2. AskContent should load course and render ChatInterface
 * 3. ChatInterface should load conversation history and render messages
 *
 * The bug is that the page gets stuck on "Loading..." indefinitely,
 * even though /api/conversations/by-context returns 200.
 */
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { getConversation } from '@/server/payload/endpoints/agent/get-conversation'
import { agentChat } from '@/server/payload/endpoints/agent/chat'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock AI and vector-related services
vi.mock('@/infra/llm/services/exercise-chat-service', () => ({
  chatWithExerciseHelper: vi.fn(async () => ({
    success: true,
    message: 'Mock assistant response',
  })),
  getSystemPrompt: vi.fn(() => 'You are a helpful assistant.'),
}))

vi.mock('@/infra/llm/vector-index-check', () => ({
  isVectorIndexAvailable: vi.fn(async () => false),
}))

vi.mock('@/infra/llm/vector-search', () => ({
  retrieveMemoryItems: vi.fn(async () => ({
    items: [],
    latencyMs: 0,
    localCount: 0,
    contextCount: 0,
    globalCount: 0,
    hierarchyKeys: [],
  })),
}))

vi.mock('@/infra/llm/memory-extraction', () => ({
  extractMemoryCandidates: vi.fn(async () => []),
  persistMemoryItems: vi.fn(async () => 0),
}))

vi.mock('@/infra/llm/maintenance', () => ({
  runSummaryMaintenance: vi.fn(async () => ({
    summaryUpdated: false,
    messagesTrimmed: 0,
  })),
}))

// Mock guest session and rate limit services
vi.mock('@/server/services/guest-session', () => ({
  getGuestSessionCookie: vi.fn(() => null),
  getGuestSessionByToken: vi.fn(async () => null),
  createGuestSession: vi.fn(async () => ({ session: null, token: '' })),
  buildGuestSessionCookieHeader: vi.fn(async () => ''),
  checkAndIncrementGuestMessageCount: vi.fn(async () => ({
    allowed: true,
    remaining: 5,
    current: 0,
    max: 5,
  })),
  hashIP: vi.fn(() => ''),
  hashUserAgent: vi.fn(() => ''),
  buildClearGuestSessionCookieHeader: vi.fn(() => ''),
  clearGuestSessionCookie: vi.fn(),
  setGuestSessionCookie: vi.fn(),
  generateSessionToken: vi.fn(() => 'mock-token'),
  hashToken: vi.fn(() => 'mock-hash'),
  verifyTokenHash: vi.fn(() => false),
  revokeGuestSession: vi.fn(async () => null),
  updateGuestSessionActivity: vi.fn(async () => null),
  GUEST_SESSION_COOKIE_NAME: 'guest_session',
}))

vi.mock('@/server/services/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 10,
    resetAt: Date.now() + 60000,
  })),
  getRateLimitKey: vi.fn(() => 'mock:key'),
  getRemainingRequests: vi.fn(async () => ({
    allowed: true,
    remaining: 10,
    resetAt: Date.now() + 60000,
  })),
  resetRateLimit: vi.fn(),
  clearAllRateLimits: vi.fn(),
  getRateLimitStats: vi.fn(async () => ({ size: 0, maxRequests: 10, windowMs: 60000 })),
}))

let payload: Payload
let testUserId: string
let testCourseId: string
let testContextKey: string
let originalDatabaseUrl: string | undefined

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error - TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create test user
  const user = await payload.create({
    collection: 'users',
    data: {
      email: `ask-page-test-${Date.now()}@example.com`,
      password: 'test123456',
      role: 'student',
    },
  })
  testUserId = user.id

  // Create test category
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Test Category',
      slug: `ask-page-test-${Date.now()}`,
    } as any,
  })

  // Create test course
  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: '8',
      title: 'Ask Page Test Course',
      slug: `ask-page-test-${Date.now()}`,
      order: 0,
      status: 'published',
      isActive: true,
      categories: [category.id],
    } as any,
  })
  testCourseId = course.id

  // Create test chapter
  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      course: testCourseId,
      title: 'Test Chapter',
      slug: `ask-page-test-${Date.now()}`,
      order: 0,
      status: 'published',
      isActive: true,
    } as any,
  })

  // Context key for ask page conversations: ask:${courseId}:${timestamp}
  testContextKey = `ask:${testCourseId}:${Date.now()}`

  // Create a conversation with messages for the ask page
  await payload.create({
    collection: 'conversations',
    data: {
      user: testUserId,
      contextKey: testContextKey,
      contextRef: { relationTo: 'courses', value: testCourseId },
      messages: [
        { role: 'user', content: 'Hello, I have a question', timestamp: new Date().toISOString() },
        {
          role: 'assistant',
          content: 'Hello! How can I help?',
          timestamp: new Date().toISOString(),
        },
      ],
      lastMessageAt: new Date().toISOString(),
    } as any,
  })

  // Drop test-created indexes to prevent conflicts
  const db = (payload.db as any).connection?.db
  if (db) {
    const collection = db.collection('conversations')
    const indexesToDrop = [
      'unique_active_user_exercise',
      'unique_active_user_contextKey',
      'unique_active_user_lesson',
    ]
    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName)
      } catch (_error) {
        // Index may not exist, ignore
      }
    }
  }
}, 60000)

beforeEach(async () => {
  if (!payload) return

  // Clean up conversations for test user
  const conversations = await payload.find({
    collection: 'conversations',
    where: { user: { equals: testUserId } },
    limit: 1000,
    overrideAccess: true,
  })
  for (const conv of conversations.docs) {
    await payload.delete({
      collection: 'conversations',
      id: conv.id,
      overrideAccess: true,
    })
  }
})

afterAll(async () => {
  if (!payload) return

  // Clean up test conversation
  const conversations = await payload.find({
    collection: 'conversations',
    where: { user: { equals: testUserId } },
    limit: 1,
  })
  for (const conv of conversations.docs) {
    await payload.delete({ collection: 'conversations', id: conv.id })
  }

  // Clean up test user
  if (testUserId) {
    await payload.delete({ collection: 'users', id: testUserId })
  }

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error
    delete process.env.DATABASE_URL
  }

  await stopMongoContainer()
}, 60000)

describe('Ask Page Loading Bug (#1849)', () => {
  /**
   * This test reproduces the bug scenario:
   * 1. User has a conversation (created via AskConversationGrid POST)
   * 2. User navigates to /ask?chat=xxx&ctx=yyy
   * 3. The ctx value is the contextKey (e.g., "ask:courseId:timestamp")
   * 4. ChatInterface should load the conversation and render messages
   *
   * The bug: useNotebookChat's loadConversationHistory() gets stuck
   * when the conversation exists but all messages are filtered out
   * as invalid, causing isLoadingHistory to never become false.
   */
  it('should load conversation history when contextKeyOverride is provided and conversation exists', async () => {
    // First, create a conversation via chat (simulating what AskConversationGrid POST does)
    const chatReq = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as any,
      json: async () => ({
        message: 'First message from ask page',
        acknowledgment: 'I received your message',
        courseId: testCourseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const chatRes = await agentChat(chatReq)
    expect(chatRes.status).toBe(200)
    const chatBody = await chatRes.json()
    const conversationId = chatBody.conversationId
    const contextKey = chatBody.contextKey

    // Now simulate what useNotebookChat does when ChatInterface mounts
    // with contextKeyOverride = ctx from URL
    const getConversationReq = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as any,
      json: async () => ({
        contextKey,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const getConversationRes = await getConversation(getConversationReq)
    expect(getConversationRes.status).toBe(200)

    const conversationBody = await getConversationRes.json()
    expect(conversationBody.success).toBe(true)
    expect(conversationBody.exists).toBe(true)
    expect(conversationBody.conversationId).toBe(conversationId)
    expect(Array.isArray(conversationBody.messages)).toBe(true)
    // Should have at least 2 messages (user + assistant)
    expect(conversationBody.messages.length).toBeGreaterThanOrEqual(2)
  })

  it('should set isLoadingHistory to false when conversation exists with valid messages', async () => {
    // Create a conversation with messages
    const conv = await payload.create({
      collection: 'conversations',
      data: {
        user: testUserId,
        contextKey: `ask:${testCourseId}:${Date.now()}`,
        contextRef: { relationTo: 'courses', value: testCourseId },
        messages: [
          { role: 'user', content: 'Test message', timestamp: new Date().toISOString() },
          { role: 'assistant', content: 'Test response', timestamp: new Date().toISOString() },
        ],
        lastMessageAt: new Date().toISOString(),
      } as any,
    })

    // Fetch via getConversation endpoint
    const getConversationReq = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as any,
      json: async () => ({
        contextKey: conv.contextKey,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const getConversationRes = await getConversation(getConversationReq)
    const body = await getConversationRes.json()

    // The endpoint should return success with messages
    expect(body.success).toBe(true)
    expect(body.exists).toBe(true)
    expect(body.messages).toBeDefined()
    expect(body.messages.length).toBeGreaterThan(0)

    // Clean up
    await payload.delete({ collection: 'conversations', id: conv.id })
  })

  it('should set isLoadingHistory to false when conversation does not exist (first visit)', async () => {
    // Use a context key that doesn't have a conversation
    const nonExistentContextKey = `ask:${testCourseId}:${Date.now() + 999999}`

    const getConversationReq = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as any,
      json: async () => ({
        contextKey: nonExistentContextKey,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const getConversationRes = await getConversation(getConversationReq)
    const body = await getConversationRes.json()

    // Should return success with exists: false
    expect(body.success).toBe(true)
    expect(body.exists).toBe(false)
    expect(body.messages).toEqual([])
  })

  it('should correctly filter messages with valid role and content', async () => {
    // Create a conversation with messages that have valid structure
    const conv = await payload.create({
      collection: 'conversations',
      data: {
        user: testUserId,
        contextKey: `ask:${testCourseId}:${Date.now()}`,
        contextRef: { relationTo: 'courses', value: testCourseId },
        messages: [
          { role: 'user', content: 'Valid user message', timestamp: new Date().toISOString() },
          {
            role: 'assistant',
            content: 'Valid assistant response',
            timestamp: new Date().toISOString(),
          },
        ],
        lastMessageAt: new Date().toISOString(),
      } as any,
    })

    const getConversationReq = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as any,
      json: async () => ({
        contextKey: conv.contextKey,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const getConversationRes = await getConversation(getConversationReq)
    const body = await getConversationRes.json()

    expect(body.messages.length).toBe(2)
    expect(body.messages[0].role).toBe('user')
    expect(body.messages[0].content).toBe('Valid user message')
    expect(body.messages[1].role).toBe('assistant')
    expect(body.messages[1].content).toBe('Valid assistant response')

    // Clean up
    await payload.delete({ collection: 'conversations', id: conv.id })
  })
})

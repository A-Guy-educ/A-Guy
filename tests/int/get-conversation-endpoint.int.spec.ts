/**
 * Integration tests for the /api/agent/conversation endpoint
 *
 * Tests:
 * - Authenticated user gets only their conversation
 * - Different users don't see each other's conversations
 * - Unauthenticated request returns 401
 * - Explicit user filtering guarantees isolation
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import { getConversation } from '@/server/payload/endpoints/agent/get-conversation'
import { agentChat } from '@/server/payload/endpoints/agent/chat'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

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

let payload: Payload
let testUserId: string
let testUserId2: string
let testExerciseId: string
let originalDatabaseUrl: string | undefined

// Clean up conversations before each test to ensure isolation
beforeEach(async () => {
  if (!payload) return

  const conversations = await payload.find({
    collection: 'conversations',
    where: {
      or: [{ user: { equals: testUserId } }, { user: { equals: testUserId2 } }],
    },
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

beforeAll(async () => {
  // Save original DATABASE_URL and unset it before starting testcontainers
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
  delete process.env.DATABASE_URL

  // Start MongoDB test container
  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  // Import config AFTER setting DATABASE_URL
  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create first test user
  const user1 = await payload.create({
    collection: 'users',
    data: {
      email: `get-conv-${Date.now()}@example.com`,
      password: 'test123456',
      role: 'student',
    },
  })
  testUserId = user1.id

  // Create second test user
  const user2 = await payload.create({
    collection: 'users',
    data: {
      email: `get-conv-2-${Date.now()}@example.com`,
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
    // Need to create lesson first
    const existingLessons = await payload.find({
      collection: 'lessons',
      limit: 1,
    })

    let testLessonId: string
    if (existingLessons.docs.length > 0) {
      testLessonId = existingLessons.docs[0].id
    } else {
      // Need to create chapter first
      const existingChapters = await payload.find({
        collection: 'chapters',
        limit: 1,
      })

      let testChapterId: string
      if (existingChapters.docs.length > 0) {
        testChapterId = existingChapters.docs[0].id
      } else {
        // Need to create course first
        const existingCourses = await payload.find({
          collection: 'courses',
          limit: 1,
        })

        let testCourseId: string
        if (existingCourses.docs.length > 0) {
          testCourseId = existingCourses.docs[0].id
        } else {
          const existingCategories = await payload.find({
            collection: 'categories',
            limit: 1,
          })

          let testCategoryId: string
          if (existingCategories.docs.length > 0) {
            testCategoryId = existingCategories.docs[0].id
          } else {
            const category = await payload.create({
              collection: 'categories',
              data: {
                title: 'Test Category',
                slug: `test-category-${Date.now()}`,
              } as any,
            })
            testCategoryId = category.id
          }

          const course = await payload.create({
            collection: 'courses',
            data: {
              courseLabel: 'Test',
              title: 'Test Course',
              slug: `test-course-${Date.now()}`,
              order: 0,
              status: 'published',
              isActive: true,
              categories: [testCategoryId],
            } as any,
          })
          testCourseId = course.id
        }

        const chapter = await payload.create({
          collection: 'chapters',
          data: {
            course: testCourseId,
            title: 'Test Chapter',
            slug: `test-chapter-${Date.now()}`,
            order: 0,
            status: 'published',
            isActive: true,
          } as any,
        })
        testChapterId = chapter.id
      }

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          chapter: testChapterId,
          title: 'Test Lesson',
          slug: `test-lesson-${Date.now()}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })
      testLessonId = lesson.id
    }

    const exercise = await payload.create({
      collection: 'exercises',
      data: {
        title: 'Test Exercise',
        slug: `test-exercise-${Date.now()}`,
        lesson: testLessonId,
        order: 0,
        _status: 'published',
      } as any,
    })
    testExerciseId = exercise.id
  }

  // Drop test-created indexes from other test files to prevent conflicts

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

  // Restore original DATABASE_URL
  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
    delete process.env.DATABASE_URL
  }

  // Stop MongoDB container
  await stopMongoContainer()
}, 60000)

describe('Get Conversation Endpoint', () => {
  it('should return 401 when unauthenticated', async () => {
    const req = {
      payload,
      user: null, // No user
      json: async () => ({
        contextKey: `exercises:${testExerciseId}`,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await getConversation(req)
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.error).toBe('Authentication required')
  })

  it('should return empty result when no conversation exists', async () => {
    const contextKey = `exercises:${testExerciseId}-nonexistent-${Date.now()}`

    const req = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({
        contextKey,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await getConversation(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.exists).toBe(false)
    expect(body.messages).toEqual([])
    expect(body.contextKey).toBe(contextKey)
  })

  it('should return conversation for authenticated user', async () => {
    const contextKey = `exercises:${testExerciseId}`

    // Create conversation by sending a chat message
    const chatReq = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({
        message: 'Test message',
        acknowledgment: 'ack',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const chatRes = await agentChat(chatReq)
    expect(chatRes.status).toBe(200)
    const chatBody = await chatRes.json()
    const conversationId = chatBody.conversationId

    // Fetch conversation via new endpoint
    const req = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({
        contextKey,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await getConversation(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.exists).toBe(true)
    expect(body.conversationId).toBe(conversationId)
    expect(Array.isArray(body.messages)).toBe(true)
    expect(body.messages.length).toBeGreaterThan(0)
  })

  it('should enforce user isolation - different users see different conversations', async () => {
    const contextKey = `exercises:${testExerciseId}`

    // User 1 sends a message
    const chatReq1 = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({
        message: 'User 1 private message',
        acknowledgment: 'ack',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const chatRes1 = await agentChat(chatReq1)
    expect(chatRes1.status).toBe(200)
    const chatBody1 = await chatRes1.json()
    const conversationId1 = chatBody1.conversationId

    // User 2 sends a message (different conversation for same exercise)
    const chatReq2 = {
      payload,
      user: { id: testUserId2 } as any,
      json: async () => ({
        message: 'User 2 private message',
        acknowledgment: 'ack',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const chatRes2 = await agentChat(chatReq2)
    expect(chatRes2.status).toBe(200)
    const chatBody2 = await chatRes2.json()
    const conversationId2 = chatBody2.conversationId

    // Verify conversations are different
    expect(conversationId1).not.toBe(conversationId2)

    // User 1 should only see their own conversation
    const req1 = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({
        contextKey,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res1 = await getConversation(req1)
    expect(res1.status).toBe(200)
    const body1 = await res1.json()
    expect(body1.success).toBe(true)
    expect(body1.exists).toBe(true)
    expect(body1.conversationId).toBe(conversationId1)
    expect(body1.messages.some((m: { content: string }) => m.content.includes('User 1'))).toBe(true)
    expect(body1.messages.some((m: { content: string }) => m.content.includes('User 2'))).toBe(
      false,
    )

    // User 2 should only see their own conversation
    const req2 = {
      payload,
      user: { id: testUserId2 } as any,
      json: async () => ({
        contextKey,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res2 = await getConversation(req2)
    expect(res2.status).toBe(200)
    const body2 = await res2.json()
    expect(body2.success).toBe(true)
    expect(body2.exists).toBe(true)
    expect(body2.conversationId).toBe(conversationId2)
    expect(body2.messages.some((m: { content: string }) => m.content.includes('User 2'))).toBe(true)
    expect(body2.messages.some((m: { content: string }) => m.content.includes('User 1'))).toBe(
      false,
    )
  })

  it('should explicitly filter by user ID in query', async () => {
    const contextKey = `exercises:${testExerciseId}`

    // Create conversations for both users manually
    const conv1 = await payload.create({
      collection: 'conversations',
      data: {
        user: testUserId,
        contextRef: { relationTo: 'exercises', value: testExerciseId },
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
        messages: [
          { role: 'user', content: 'User 2 message', timestamp: new Date().toISOString() },
        ],
        lastMessageAt: new Date().toISOString(),
      } as any,
    })

    // User 1 should only get their conversation
    const req1 = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({
        contextKey,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res1 = await getConversation(req1)
    expect(res1.status).toBe(200)
    const body1 = await res1.json()
    expect(body1.conversationId).toBe(conv1.id)
    expect(body1.messages.some((m: { content: string }) => m.content.includes('User 1'))).toBe(true)

    // User 2 should only get their conversation
    const req2 = {
      payload,
      user: { id: testUserId2 } as any,
      json: async () => ({
        contextKey,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res2 = await getConversation(req2)
    expect(res2.status).toBe(200)
    const body2 = await res2.json()
    expect(body2.conversationId).toBe(conv2.id)
    expect(body2.messages.some((m: { content: string }) => m.content.includes('User 2'))).toBe(true)

    // Clean up
    await payload.delete({ collection: 'conversations', id: conv1.id })
    await payload.delete({ collection: 'conversations', id: conv2.id })
  })

  it('should return 400 for invalid request body', async () => {
    const req = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({
        // Missing contextKey
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await getConversation(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('Invalid request')
  })
})

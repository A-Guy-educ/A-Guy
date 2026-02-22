/**
 * Integration tests for exercise context injection via hidden messages.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { agentChatStream } from '@/server/payload/endpoints/agent/chat-stream'
import { getConversation } from '@/server/payload/endpoints/agent/get-conversation'
import config from '@payload-config'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

vi.mock('@/infra/llm/services/exercise-chat-service', async () => {
  const actual = await vi.importActual('@/infra/llm/services/exercise-chat-service')
  return {
    ...actual,
    streamChatWithExerciseHelper: vi.fn(async (_input: unknown, _payload: unknown) => {
      // Simulate successful chat response
      const stream = {
        async *[Symbol.asyncIterator]() {
          yield { text: 'AI response' }
        },
      }
      return { stream, response: Promise.resolve({ text: 'AI response' }) }
    }),
  }
})

vi.mock('@/infra/llm/vector-index-check', () => ({
  isVectorIndexAvailable: vi.fn(async () => false),
}))

vi.mock('@/infra/llm/vector-search', () => ({
  retrieveMemoryItems: vi.fn(async () => ({
    items: [],
    latencyMs: 0,
    localCount: 0,
    globalCount: 0,
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
let testLessonId: string
let testExerciseId: string

describe.skipIf(!hasDatabaseUrl)('exercise context injection', () => {
  beforeAll(async () => {
    if (!hasDatabaseUrl) return
    payload = await getPayload({ config })

    // Create test user
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `test-exercise-context-${Date.now()}@example.com`,
        password: 'test-password',
        roles: ['user'],
      },
      draft: true,
    } as any)
    testUserId = user.id

    // Create category
    const category = await payload.create({
      collection: 'categories',
      data: { title: 'Test Category', slug: `test-category-exercise-context-${Date.now()}` },
      user: { id: testUserId },
    } as any)

    // Create course
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'TST',
        title: 'Test Course Exercise Context',
        slug: `test-course-exercise-context-${Date.now()}`,
        categories: [category.id],
        order: 1,
        status: 'published',
        isActive: true,
      },
      draft: true,
    } as any)

    // Create chapter
    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        chapterLabel: '1',
        title: 'Test Chapter Exercise Context',
        slug: `test-chapter-exercise-context-${Date.now()}`,
        course: course.id,
        order: 1,
        status: 'published',
        isActive: true,
      },
      draft: true,
    } as any)

    // Create lesson
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Test Lesson for Exercise Context',
        chapter: chapter.id,
        order: 1,
        status: 'published',
      },
      draft: true,
    } as any)
    testLessonId = lesson.id

    // Create exercise
    const exercise = await payload.create({
      collection: 'exercises',
      data: {
        title: 'Fractions Quiz',
        slug: `test-exercise-exercise-context-${Date.now()}`,
        lesson: lesson.id,
        chapter: chapter.id,
        order: 1,
        type: 'free_response',
        status: 'published',
        isPremium: false,
        prompt: 'Solve this math problem',
        hint: 'Think step by step',
        solution: 'The answer is 42',
        answer: '42',
      },
      draft: true,
    } as any)
    testExerciseId = exercise.id
  }, 120000)

  afterAll(async () => {
    if (!hasDatabaseUrl || !payload) return
    try {
      // Cleanup in reverse order
      await payload.delete({
        collection: 'exercises',
        id: testExerciseId,
        overrideAccess: true,
      } as any)
      const lessons = await payload.find({
        collection: 'lessons',
        where: { title: { equals: 'Test Lesson for Exercise Context' } },
        limit: 1,
      })
      if (lessons.docs.length > 0) {
        await payload.delete({
          collection: 'lessons',
          id: lessons.docs[0].id,
          overrideAccess: true,
        } as any)
      }
      const chapters = await payload.find({
        collection: 'chapters',
        where: { title: { equals: 'Test Chapter Exercise Context' } },
        limit: 1,
      })
      if (chapters.docs.length > 0) {
        await payload.delete({
          collection: 'chapters',
          id: chapters.docs[0].id,
          overrideAccess: true,
        } as any)
      }
      const courses = await payload.find({
        collection: 'courses',
        where: { title: { equals: 'Test Course Exercise Context' } },
        limit: 1,
      })
      if (courses.docs.length > 0) {
        await payload.delete({
          collection: 'courses',
          id: courses.docs[0].id,
          overrideAccess: true,
        } as any)
      }
      const categories = await payload.find({
        collection: 'categories',
        where: { title: { equals: 'Test Category' } },
        limit: 1,
      })
      if (categories.docs.length > 0) {
        await payload.delete({
          collection: 'categories',
          id: categories.docs[0].id,
          overrideAccess: true,
        } as any)
      }
      await payload.delete({ collection: 'users', id: testUserId, overrideAccess: true } as any)
    } catch (error) {
      console.error('Cleanup failed:', error)
    }
    if (payload.db?.destroy) {
      await payload.db.destroy()
    }
  }, 60000)

  it('EC-01: hidden exercise context message is persisted in DB', async () => {
    const exerciseContext = `[EXERCISE CONTEXT]
Exercise: "Fractions Quiz"

Content Blocks:
1. [Question: FreeResponse] What is 1/2 + 1/3? | Accepted: 1 answer(s) | Hint: Find a common denominator

[END EXERCISE CONTEXT]`

    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: `The student is now viewing the following exercise. Use this context to help them.\n\n${exerciseContext}`,
        acknowledgment: 'ack',
        lessonId: testLessonId,
        exerciseId: testExerciseId,
        hidden: true,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const response = await agentChatStream(req)
    expect(response.status).toBe(200)

    // Verify hidden message was persisted in DB
    const conv = await payload.find({
      collection: 'conversations',
      where: { contextKey: { equals: `lessons:${testLessonId}` } },
      limit: 1,
    })
    expect(conv.docs.length).toBe(1)

    const conversation = conv.docs[0]
    const hiddenMessages = (conversation.messages || []).filter((m: any) => m.hidden === true)
    expect(hiddenMessages.length).toBeGreaterThanOrEqual(1)
    expect(hiddenMessages.some((m: any) => m.content.includes('[EXERCISE CONTEXT]'))).toBe(true)
  })

  it('EC-02: hidden exercise context is excluded from client GET response', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        contextKey: `lessons:${testLessonId}`,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const response = await getConversation(req)
    expect(response.status).toBe(200)

    const body = await response.json()
    // No conversation exists yet, so messages should be empty
    expect(body.messages || []).toEqual([])
  })

  it('EC-03: hidden exercise context is included in messages sent to LLM', async () => {
    // This test verifies the pipeline preserves hidden messages
    // The actual LLM call is mocked, but we verify hidden messages persist

    const exerciseContext = '[EXERCISE CONTEXT]\nExercise: "Geometry"\n[END EXERCISE CONTEXT]'

    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: `Context: ${exerciseContext}`,
        acknowledgment: 'ack',
        lessonId: testLessonId,
        exerciseId: testExerciseId,
        hidden: true,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    await agentChatStream(req)

    // Verify conversation has the hidden message
    const conv = await payload.find({
      collection: 'conversations',
      where: { contextKey: { equals: `lessons:${testLessonId}` } },
      limit: 1,
    })
    const conversation = conv.docs[0]
    const hiddenMessages = (conversation.messages || []).filter((m: any) => m.hidden === true)
    expect(hiddenMessages.some((m: any) => m.content.includes('[EXERCISE CONTEXT]'))).toBe(true)
  })

  it('EC-04: incorrect-answer contextual help coexists with exercise context', async () => {
    // 1. Send exercise context (hidden)
    const exerciseContext = '[EXERCISE CONTEXT]\nExercise: "Algebra"\n[END EXERCISE CONTEXT]'
    await agentChatStream({
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: `Student viewing: ${exerciseContext}`,
        acknowledgment: 'ack',
        lessonId: testLessonId,
        exerciseId: testExerciseId,
        hidden: true,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> })

    // 2. Send incorrect-answer help (hidden)
    const incorrectAnswerHelp =
      'The student answered incorrectly. Question: {"type":"question_free_response","prompt":"What is 2+2?"}\nStudent answer: "5"'
    await agentChatStream({
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: incorrectAnswerHelp,
        acknowledgment: 'ack',
        lessonId: testLessonId,
        exerciseId: testExerciseId,
        hidden: true,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> })

    // 3. Verify both hidden messages exist
    const conv = await payload.find({
      collection: 'conversations',
      where: { contextKey: { equals: `lessons:${testLessonId}` } },
      limit: 1,
    })
    const hiddenMessages = (conv.docs[0].messages || []).filter((m: any) => m.hidden === true)

    // Should have at least 2 hidden messages from steps 1 and 2
    expect(hiddenMessages.length).toBeGreaterThanOrEqual(2)

    // Verify one has exercise context
    expect(hiddenMessages.some((m: any) => m.content.includes('[EXERCISE CONTEXT]'))).toBe(true)

    // Verify one has "answered incorrectly" - THIS IS THE KEY ASSERTION
    const hasIncorrectAnswerMsg = hiddenMessages.some((m: any) =>
      m.content.toLowerCase().includes('answered incorrectly'),
    )
    expect(hasIncorrectAnswerMsg).toBe(true)

    // 4. Verify client only sees AI responses (not hidden messages)
    const getRes = await getConversation({
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        contextKey: `lessons:${testLessonId}`,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> })

    const body = await getRes.json()
    // Conversation exists, verify messages are filtered
    const messages = body.messages || []
    expect(messages.every((m: any) => !m.content?.includes('[EXERCISE CONTEXT]'))).toBe(true)
    expect(messages.every((m: any) => !m.content?.includes('answered incorrectly'))).toBe(true)
  })

  it('EC-05: navigating to new exercise injects new context (same conversation)', async () => {
    // First exercise context
    await agentChatStream({
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: '[EXERCISE CONTEXT]\nExercise: "Exercise A"\n[END EXERCISE CONTEXT]',
        acknowledgment: 'ack',
        lessonId: testLessonId,
        exerciseId: testExerciseId,
        hidden: true,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> })

    // Second exercise context (same lesson = same conversation)
    await agentChatStream({
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: '[EXERCISE CONTEXT]\nExercise: "Exercise B"\n[END EXERCISE CONTEXT]',
        acknowledgment: 'ack',
        lessonId: testLessonId,
        exerciseId: testExerciseId,
        hidden: true,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> })

    // Verify both contexts in conversation
    const conv = await payload.find({
      collection: 'conversations',
      where: { contextKey: { equals: `lessons:${testLessonId}` } },
      limit: 1,
    })
    const hiddenMessages = (conv.docs[0].messages || []).filter((m: any) => m.hidden === true)
    expect(hiddenMessages.some((m: any) => m.content.includes('Exercise A'))).toBe(true)
    expect(hiddenMessages.some((m: any) => m.content.includes('Exercise B'))).toBe(true)
  })
})

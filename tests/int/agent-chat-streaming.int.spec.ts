/**
 * Integration tests for the /api/agent/chat/stream endpoint (streaming chat).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { agentChatStream } from '@/server/payload/endpoints/agent/chat-stream'
import config from '@payload-config'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

const mockStreamChunks = ['Hello', ' there', '! How', ' can', ' I', ' help', '?']

// Create a proper async iterable for mocking
const createMockStream = () => {
  let index = 0
  return {
    async *[Symbol.asyncIterator]() {
      while (index < mockStreamChunks.length) {
        yield { text: mockStreamChunks[index] }
        index++
      }
    },
  }
}

vi.mock('@/infra/llm/services/exercise-chat-service', () => ({
  streamChatWithExerciseHelper: vi.fn(async () => {
    const stream = createMockStream()
    const response = Promise.resolve({ text: mockStreamChunks.join('') })
    return { stream, response }
  }),
}))

// Mock student-tool-calling to prevent RuntimeConfig access in new code path
vi.mock('@/infra/llm/services/student-tool-calling', () => ({
  STUDENT_CHAT_TOOLS: [],
  buildStudentToolExecutor: vi.fn(() => async () => '{}'),
  streamingChatWithStudentTools: vi.fn(async () => {
    const stream = createMockStream()
    const response = Promise.resolve({ text: mockStreamChunks.join(''), toolCalls: [] })
    return { stream, response }
  }),
}))

// Mock isUsersCollectionUser to return false so student mode is not triggered
vi.mock('@/server/payload/access/isUsersCollectionUser', () => ({
  isUsersCollectionUser: vi.fn(() => false),
}))

// Mock AccountRole to return Admin - must keep the enum structure for collection config
vi.mock('@/server/payload/collections/Users/roles', () => ({
  AccountRole: {
    Admin: 'admin',
    Student: 'student',
  },
  ACCOUNT_ROLE_LABEL: {
    admin: 'Admin',
    student: 'Student',
  },
}))

// Mock getLLMProvider to prevent RuntimeConfig access
vi.mock('@/infra/llm/providers/factory', () => ({
  getLLMProvider: vi.fn(async () => ({})),
  getProviderTypeFromEnv: vi.fn(async () => 'gemini'),
}))

// Mock MCP client for student tool-calling path
vi.mock('@/server/repos/mcp/client/mcp-client', () => ({
  getMCPClient: vi.fn(() => ({
    listTools: vi.fn(async () => []),
    callTool: vi.fn(async () => ({ content: [] })),
  })),
}))

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

// Mock guest session and rate limit services to prevent interference with auth tests
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
let testExerciseId: string
let testChapterId: string
let _testCourseId: string
let _testCategoryId: string
let lessons: { docs: Array<{ id: string }> }

describe.skipIf(!hasDatabaseUrl)('agentChatStream', () => {
  beforeAll(async () => {
    if (!hasDatabaseUrl) return
    payload = await getPayload({ config })
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `test-stream-${Date.now()}@example.com`,
        password: 'test-password',
        roles: ['user'],
      },
      draft: true,
    } as any)
    testUserId = user.id
    // Create a category first (required by courses)
    const category = await payload.create({
      collection: 'categories',
      data: { title: 'Test Category', slug: `test-category-stream-${Date.now()}` },
      user: { id: testUserId },
    } as any)
    _testCategoryId = category.id

    // Create test course with all required fields
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'TST',
        title: 'Test Course Stream',
        slug: `test-course-stream-${Date.now()}`,
        categories: [category.id],
        order: 1,
        status: 'published',
        isActive: true,
      },
      draft: true,
    } as any)
    _testCourseId = course.id

    // Create test chapter with all required fields
    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        chapterLabel: '1',
        title: 'Test Chapter Stream',
        slug: `test-chapter-stream-${Date.now()}`,
        course: course.id,
        order: 1,
        status: 'published',
        isActive: true,
      },
      draft: true,
    } as any)
    testChapterId = chapter.id
    // Create a lesson first (required for exercise)
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Test Lesson for Exercise Stream',
        chapter: testChapterId,
        order: 1,
        status: 'published',
      },
      draft: true,
    } as any)

    testExerciseId = (
      await payload.create({
        collection: 'exercises',
        data: {
          title: 'Test Exercise Stream',
          slug: `test-exercise-stream-${Date.now()}`,
          lesson: lesson.id,
          chapter: testChapterId,
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
    ).id
  }, 60000)

  afterAll(async () => {
    if (!hasDatabaseUrl || !payload) return
    try {
      await payload.delete({
        collection: 'exercises',
        id: testExerciseId,
        overrideAccess: true,
      } as any)
      // Find and delete the lesson we created
      lessons = await payload.find({
        collection: 'lessons',
        where: { title: { equals: 'Test Lesson for Exercise Stream' } },
        limit: 1,
      })
      if (lessons.docs.length > 0) {
        await payload.delete({
          collection: 'lessons',
          id: lessons.docs[0].id,
          overrideAccess: true,
        } as any)
      }
      // Find and delete the chapter we created
      const chapters = await payload.find({
        collection: 'chapters',
        where: { title: { equals: 'Test Chapter Stream' } },
        limit: 1,
      })
      if (chapters.docs.length > 0) {
        await payload.delete({
          collection: 'chapters',
          id: chapters.docs[0].id,
          overrideAccess: true,
        } as any)
      }
      // Find and delete the course we created
      const courses = await payload.find({
        collection: 'courses',
        where: { title: { equals: 'Test Course Stream' } },
        limit: 1,
      })
      if (courses.docs.length > 0) {
        await payload.delete({
          collection: 'courses',
          id: courses.docs[0].id,
          overrideAccess: true,
        } as any)
      }
      // Find and delete the category we created
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
      // Delete test user
      await payload.delete({
        collection: 'users',
        id: testUserId,
        overrideAccess: true,
      } as any)
    } catch (error) {
      console.error('Cleanup failed:', error)
    }

    // Close DB connection to prevent connection leaks
    if (payload.db?.destroy) {
      await payload.db.destroy()
    }
  }, 120000)

  it('returns 401 when user is not authenticated', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: null,
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }
    const response = await agentChatStream(req)
    expect(response.status).toBe(401)
  })

  it('returns 400 when message is missing', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        acknowledgment: 'ack',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }
    const response = await agentChatStream(req)
    expect(response.status).toBe(400)
  })

  it('returns 400 when acknowledgment is missing', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }
    const response = await agentChatStream(req)
    expect(response.status).toBe(400)
  })

  it('returns 400 when context is missing', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack',
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }
    const response = await agentChatStream(req)
    expect(response.status).toBe(400)
  })

  it('returns 400 when mediaIds are provided', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack',
        exerciseId: testExerciseId,
        mediaIds: ['some-media-id'],
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }
    const response = await agentChatStream(req)
    expect(response.status).toBe(400)
    const errorBody = await response.json()
    expect(errorBody.error).toMatch(/media attachments are not supported/i)
  })

  it('returns 400 when adminMode is true', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack',
        exerciseId: testExerciseId,
        adminMode: true,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }
    const response = await agentChatStream(req)
    expect(response.status).toBe(400)
    const errorBody = await response.json()
    expect(errorBody.error).toMatch(/admin mode is not supported/i)
  })

  it('returns SSE stream with correct headers', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({ message: 'Hello', acknowledgment: 'ack', exerciseId: testExerciseId }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }
    const response = await agentChatStream(req)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform')
    expect(response.headers.get('X-Accel-Buffering')).toBe('no')
  })

  it('yields chunk events in SSE format', async () => {
    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId, role: 'admin' } as unknown as PayloadRequest['user'],
      json: async () => ({ message: 'Hello', acknowledgment: 'ack', exerciseId: testExerciseId }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }
    const response = await agentChatStream(req)
    const reader = response.body?.getReader()
    expect(reader).toBeDefined()
    const decoder = new TextDecoder()
    let chunks = ''
    let done = false
    while (!done) {
      const { value, done: doneReading } = await reader!.read()
      done = doneReading
      chunks += decoder.decode(value, { stream: true })
    }
    expect(chunks).toContain('event: chunk')
    expect(chunks).toContain('event: done')
    expect(chunks).toContain('data: ')
    for (const chunk of mockStreamChunks) {
      expect(chunks).toContain(chunk)
    }
  })
})

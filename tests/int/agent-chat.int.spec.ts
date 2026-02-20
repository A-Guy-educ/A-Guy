/**
 * Integration tests for the /api/agent/chat endpoint logic (agentChat).
 *
 * These tests focus on:
 * - Authentication behavior (401 when unauthenticated)
 * - Happy-path chat flow with a real Payload instance
 *   (AI calls and vector search are mocked to avoid external dependencies).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Exercise } from '@/payload-types'
import { agentChat } from '@/server/payload/endpoints/agent/chat'
import config from '@payload-config'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// Skip tests if DATABASE_URL is not set (e.g., in CI without MongoDB service)
const hasDatabaseUrl = !!process.env.DATABASE_URL

// Mock AI and vector-related services to keep tests deterministic and offline.
vi.mock('@/infra/llm/services/exercise-chat-service', () => ({
  chatWithExerciseHelper: vi.fn(async () => ({
    success: true,
    message: 'Mock assistant response',
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
let testExerciseId: string | undefined
let testChapterId: string
let testPromptId: string
let testSystemPromptId: string | undefined

beforeAll(
  async () => {
    payload = await getPayload({ config })

    const user = await payload.create({
      collection: 'users',
      data: {
        email: `agent-chat-int-${Date.now()}@example.com`,
        password: 'test123456',
        role: 'student',
      },
    })
    testUserId = user.id

    // Create a category first (required by courses)
    const category = await payload.create({
      collection: 'categories',
      data: { title: 'Test Category', slug: `test-category-${Date.now()}` },
      user: { id: testUserId },
    } as any)

    // Create test course with all required fields
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'TST',
        title: 'Test Course',
        slug: `test-course-${Date.now()}`,
        categories: [category.id],
        order: 1,
        status: 'published',
        isActive: true,
      },
      draft: true,
    } as any)

    // Create test chapter with all required fields
    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        chapterLabel: '1',
        title: 'Test Chapter',
        slug: `test-chapter-${Date.now()}`,
        course: course.id,
        order: 1,
        status: 'published',
        isActive: true,
      },
      draft: true,
    } as any)
    testChapterId = chapter.id

    // Create a default prompt for tests (requires overrideAccess since it's admin-only)
    const prompt = await payload.create({
      collection: 'prompts',
      data: {
        title: 'Integration Test Default Prompt',
        key: `int-test-default-${Date.now()}`,
        template: 'You are a test assistant for integration tests.',
        type: 'context',
        status: 'published',
        isDefaultForAgentChat: true,
      },
      overrideAccess: true,
    } as any)
    testPromptId = prompt.id

    // Create a published system prompt for tests
    const systemPrompt = await payload.create({
      collection: 'prompts',
      data: {
        title: 'Integration Test System Prompt',
        key: `int-test-system-${Date.now()}`,
        template: 'SYSTEM_PROMPT_MARKER: You must always follow these rules.',
        type: 'system',
        status: 'published',
      },
      overrideAccess: true,
    } as any)
    testSystemPromptId = systemPrompt.id

    // Reuse an existing exercise if available; otherwise create a minimal one.
    const existingExercises = await payload.find({
      collection: 'exercises',
      limit: 1,
    })

    if (existingExercises.docs.length > 0) {
      testExerciseId = existingExercises.docs[0].id
    } else {
      // Create a lesson first (required for exercise)
      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          title: 'Test Lesson for Exercise',
          chapter: testChapterId,
          order: 1,
          status: 'published',
        },
        draft: true,
      } as any)

      const exercise = await payload.create({
        collection: 'exercises',
        data: {
          title: 'Agent Chat Integration Test Exercise',
          lesson: lesson.id,
        } satisfies Partial<Exercise>,
        draft: true,
      })
      testExerciseId = exercise.id
    }
  },
  60000, // Increased timeout for Payload initialization
)

afterAll(async () => {
  if (!payload) return

  // Cleanup prompt first (it may be referenced by lessons)
  if (testPromptId) {
    try {
      await payload.delete({ collection: 'prompts', id: testPromptId, overrideAccess: true } as any)
    } catch {
      // Ignore cleanup errors
    }
  }

  // Cleanup system prompt
  if (testSystemPromptId) {
    try {
      await payload.delete({
        collection: 'prompts',
        id: testSystemPromptId,
        overrideAccess: true,
      } as any)
    } catch {
      // Ignore cleanup errors
    }
  }

  if (testUserId) {
    await payload.delete({
      collection: 'users',
      id: testUserId,
    })
  }

  // Close DB connection to prevent connection leaks
  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
}, 30000)

describe.skipIf(!hasDatabaseUrl)('agentChat endpoint', () => {
  it('returns 401 when user is not authenticated', async () => {
    const req = {
      payload,
      headers: new Headers(),
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack-1',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)
    expect(res.status).toBe(401)
  })

  it('processes chat request successfully for authenticated user', async () => {
    if (!testExerciseId) {
      throw new Error('testExerciseId was not initialized')
    }

    const req = {
      payload,
      headers: new Headers(),
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello, can you help me with this exercise?',
        acknowledgment: 'ack-1',
        exerciseId: testExerciseId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(typeof body.message).toBe('string')
    expect(body.message).toBe('Mock assistant response')
    expect(body.conversationId).toBeDefined()

    // Verify conversation was created and contains both user and assistant messages.
    const conversation = await payload.findByID({
      collection: 'conversations',
      id: body.conversationId,
    })

    expect(conversation).toBeDefined()
    expect(Array.isArray(conversation.messages)).toBe(true)
    expect(conversation.messages!.length).toBeGreaterThanOrEqual(2)
  }, 60000)

  describe('prompt resolution', () => {
    it('uses default prompt when lesson has no prompt', async () => {
      // Create a lesson WITHOUT a prompt
      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          title: 'Test Lesson Without Prompt',
          chapter: testChapterId,
          order: 1,
          status: 'published',
          // No prompt field - will use default
        },
        draft: true,
      } as any)

      const req = {
        payload,
        headers: new Headers(),
        user: { id: testUserId } as PayloadRequest['user'],
        json: async () => ({
          message: 'Hello',
          acknowledgment: 'ack-1',
          lessonId: lesson.id,
        }),
      } as unknown as PayloadRequest & { json: () => Promise<unknown> }

      const res = await agentChat(req)
      expect(res.status).toBe(200)

      // Cleanup
      await payload.delete({ collection: 'lessons', id: lesson.id } as any)
    })

    it('falls back to default when lesson prompt is draft', async () => {
      // Create draft prompt (requires overrideAccess since it's admin-only)
      const draftPrompt = await payload.create({
        collection: 'prompts',
        data: {
          title: 'Draft Prompt',
          key: `draft-prompt-${Date.now()}`,
          template: 'Draft content.',
          status: 'draft', // Not published
        },
        overrideAccess: true,
      } as any)

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          title: 'Test Lesson With Draft Prompt',
          chapter: testChapterId,
          order: 1,
          status: 'published',
          prompt: draftPrompt.id,
        },
        draft: true,
      } as any)

      const req = {
        payload,
        headers: new Headers(),
        user: { id: testUserId } as PayloadRequest['user'],
        json: async () => ({
          message: 'Hello',
          acknowledgment: 'ack-1',
          lessonId: lesson.id,
        }),
      } as unknown as PayloadRequest & { json: () => Promise<unknown> }

      const res = await agentChat(req)
      expect(res.status).toBe(200)
      // The default prompt (testPromptId) should be used

      // Cleanup
      await payload.delete({ collection: 'lessons', id: lesson.id } as any)
      await payload.delete({ collection: 'prompts', id: draftPrompt.id } as any)
    })

    it('endpoint always passes composedPrompt to chatWithExerciseHelper', async () => {
      const { chatWithExerciseHelper } = await import('@/infra/llm/services/exercise-chat-service')

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          title: 'Test Lesson',
          slug: `test-lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          chapter: testChapterId,
          order: 1,
          status: 'published',
        },
        draft: true,
      } as any)

      const req = {
        payload,
        headers: new Headers(),
        user: { id: testUserId } as PayloadRequest['user'],
        json: async () => ({
          message: 'Hello',
          acknowledgment: 'ack-1',
          lessonId: lesson.id,
        }),
      } as unknown as PayloadRequest & { json: () => Promise<unknown> }

      await agentChat(req)

      // Verify mock was called at least once
      expect(chatWithExerciseHelper).toHaveBeenCalled()

      // Get the last call arguments safely to avoid verbose error expansion
      const mockCalls = (chatWithExerciseHelper as unknown as { mock: { calls: Array<[unknown]> } })
        .mock.calls
      const lastCallArgs = mockCalls[mockCalls.length - 1]?.[0] as {
        composedPrompt?: unknown
      }

      // Verify composedPrompt was passed
      expect(lastCallArgs?.composedPrompt).toBeDefined()

      await payload.delete({ collection: 'lessons', id: lesson.id } as any)
    })
  })

  describe('system prompts', () => {
    it('includes published system prompts in composed prompt', async () => {
      const { chatWithExerciseHelper } = await import('@/infra/llm/services/exercise-chat-service')

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          title: 'Test Lesson For System Prompts',
          slug: `test-lesson-sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          chapter: testChapterId,
          order: 1,
          status: 'published',
        },
        draft: true,
      } as any)

      const req = {
        payload,
        headers: new Headers(),
        user: { id: testUserId } as PayloadRequest['user'],
        json: async () => ({
          message: 'Hello',
          acknowledgment: 'ack-1',
          lessonId: lesson.id,
        }),
      } as unknown as PayloadRequest & { json: () => Promise<unknown> }

      await agentChat(req)

      // Verify mock was called at least once
      expect(chatWithExerciseHelper).toHaveBeenCalled()

      // Get the last call arguments safely
      const mockCalls = (chatWithExerciseHelper as unknown as { mock: { calls: Array<[unknown]> } })
        .mock.calls
      const lastCallArgs = mockCalls[mockCalls.length - 1]?.[0] as {
        composedPrompt?: { messages?: Array<{ role: string; content: string }> }
      }

      // Verify composedPrompt structure exists
      expect(lastCallArgs?.composedPrompt).toBeDefined()
      expect(lastCallArgs?.composedPrompt?.messages).toBeDefined()
      expect(Array.isArray(lastCallArgs?.composedPrompt?.messages)).toBe(true)

      // Check if any message contains our system prompt marker
      const messages = lastCallArgs?.composedPrompt?.messages || []
      const systemMessage = messages.find((m) => m.role === 'system')
      expect(systemMessage).toBeDefined()
      expect(systemMessage?.content).toContain('SYSTEM_PROMPT_MARKER')

      await payload.delete({ collection: 'lessons', id: lesson.id } as any)
    })

    it('prepends system prompts in createdAt ASC order', async () => {
      // Import after mocks are set up to get the mocked version
      const chatWithExerciseHelper = (await import('@/infra/llm/services/exercise-chat-service'))
        .chatWithExerciseHelper as ReturnType<typeof vi.fn>

      // Delete existing system prompt from beforeAll to ensure clean test
      if (testSystemPromptId) {
        try {
          await payload.delete({
            collection: 'prompts',
            id: testSystemPromptId,
            overrideAccess: true,
          } as any)
          testSystemPromptId = undefined
        } catch {
          // Ignore cleanup errors
        }
      }

      // Create two system prompts with specific markers
      // First prompt (older)
      const sysPromptA = await payload.create({
        collection: 'prompts',
        data: {
          title: 'System Prompt A (Older)',
          key: `sys-prompt-a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          template: 'SYS_MARKER_A: First system prompt.',
          type: 'system',
          status: 'published',
        },
        overrideAccess: true,
      } as any)

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Second prompt (newer)
      const sysPromptB = await payload.create({
        collection: 'prompts',
        data: {
          title: 'System Prompt B (Newer)',
          key: `sys-prompt-b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          template: 'SYS_MARKER_B: Second system prompt.',
          type: 'system',
          status: 'published',
        },
        overrideAccess: true,
      } as any)

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          title: 'Test Lesson For Ordering',
          slug: `test-lesson-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          chapter: testChapterId,
          order: 1,
          status: 'published',
        },
        draft: true,
      } as any)

      const req = {
        payload,
        headers: new Headers(),
        user: { id: testUserId } as PayloadRequest['user'],
        json: async () => ({
          message: 'Hello',
          acknowledgment: 'ack-1',
          lessonId: lesson.id,
        }),
      } as unknown as PayloadRequest & { json: () => Promise<unknown> }

      await agentChat(req)

      // Get the call arguments - use last call to ensure we get this test's call
      // Previous tests in this describe block may have called the mock
      const mockCalls = (chatWithExerciseHelper as unknown as { mock: { calls: Array<[unknown]> } })
        .mock.calls
      const lastCallIndex = mockCalls.length - 1
      const callArgs = mockCalls[lastCallIndex]?.[0] as {
        composedPrompt: { messages: Array<{ role: string; content: string }> }
      }
      const systemMessage = callArgs?.composedPrompt?.messages?.find(
        (m: { role: string }) => m.role === 'system',
      )?.content

      // Verify system prompts are prepended in correct order (A before B)
      expect(systemMessage).toBeDefined()
      if (!systemMessage) {
        throw new Error('System message not found')
      }

      // Our test markers should be present
      expect(systemMessage).toContain('SYS_MARKER_A')
      expect(systemMessage).toContain('SYS_MARKER_B')

      // Verify ordering: older prompt (A) should come before newer prompt (B)
      // This is the key assertion - createdAt ASC means older first
      const indexA = systemMessage.indexOf('SYS_MARKER_A')
      const indexB = systemMessage.indexOf('SYS_MARKER_B')

      // If ordering is working correctly, A should come before B
      if (indexA > indexB) {
        throw new Error(
          `System prompts not ordered correctly by createdAt ASC. ` +
            `Expected SYS_MARKER_A (created first) at position ${indexB}, ` +
            `but found at position ${indexA}. ` +
            `Actual order: B before A (newer before older)`,
        )
      }

      // Cleanup
      await payload.delete({ collection: 'lessons', id: lesson.id } as any)
      await payload.delete({ collection: 'prompts', id: sysPromptA.id } as any)
      await payload.delete({ collection: 'prompts', id: sysPromptB.id } as any)
    }, 30000)

    it('proceeds successfully when no system prompts exist', async () => {
      // Temporarily remove system prompt
      if (testSystemPromptId) {
        await payload.delete({
          collection: 'prompts',
          id: testSystemPromptId,
          overrideAccess: true,
        } as any)
      }

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          title: 'Test Lesson No System Prompts',
          slug: `test-lesson-nosys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          chapter: testChapterId,
          order: 1,
          status: 'published',
        },
        draft: true,
      } as any)

      const req = {
        payload,
        headers: new Headers(),
        user: { id: testUserId } as PayloadRequest['user'],
        json: async () => ({
          message: 'Hello',
          acknowledgment: 'ack-1',
          lessonId: lesson.id,
        }),
      } as unknown as PayloadRequest & { json: () => Promise<unknown> }

      const res = await agentChat(req)
      expect(res.status).toBe(200)

      // Cleanup lesson
      await payload.delete({ collection: 'lessons', id: lesson.id } as any)

      // Recreate system prompt for other tests
      const newSystemPrompt = await payload.create({
        collection: 'prompts',
        data: {
          title: 'Integration Test System Prompt',
          key: `int-test-system-recreated-${Date.now()}`,
          template: 'SYSTEM_PROMPT_MARKER: You must always follow these rules.',
          type: 'system',
          status: 'published',
        },
        overrideAccess: true,
      } as any)
      testSystemPromptId = newSystemPrompt.id
    }, 30000)
  })
})

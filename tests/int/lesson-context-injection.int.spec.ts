/**
 * Integration tests for lesson context injection
 *
 * Tests that lessonContextText is:
 * - Injected into composed prompts at runtime
 * - NOT persisted in conversations or messages
 * - Only injected for the current lesson context
 * - Rejected if oversized
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import type { Lesson } from '@/payload-types'
import { LESSON_CONTEXT_BLOCK_START, LESSON_CONTEXT_MAX_CHARS } from '@/lib/ai/lesson-context'

// Skip tests if DATABASE_URL is not set
const hasDatabaseUrl = !!process.env.DATABASE_URL

// Mock AI and vector-related services (must be before any imports that use them)
vi.mock('@/lib/ai/services/exercise-chat-service', () => ({
  chatWithExerciseHelper: vi.fn(async () => ({
    success: true,
    message: 'Mock assistant response',
  })),
  getSystemPrompt: vi.fn(() => 'You are a helpful assistant.'),
}))

// Mock context-policy - provide implementations that return expected values
// Note: Must define spy inside return to avoid hoisting issues
vi.mock('@/lib/ai/context-policy', () => ({
  buildRetrievalQuery: vi.fn((messages: unknown[]) => {
    return messages.map((m: any) => m.content || '').join(' ')
  }),
  composePrompt: vi.fn((systemMessage: string) => ({
    messages: [],
    metadata: {
      policyVersion: 'v1',
      summaryLength: 0,
      messageCount: 0,
    },
    systemMessage,
  })),
  getRecentWindow: vi.fn((messages: unknown[]) => messages),
}))

// Import after mocks are set up
import { agentChat } from '@/endpoints/agent/chat'
import * as contextPolicy from '@/lib/ai/context-policy'

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

let payload: Payload
let testUserId: string
let testLessonId: string
let testLessonIdB: string
let testChapterId: string

beforeAll(
  async () => {
    payload = await getPayload({ config })

    // Create test user
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `lesson-context-int-${Date.now()}@example.com`,
        password: 'test123456',
        role: 'student',
      },
    })
    testUserId = user.id

    // Create a chapter (required for lessons)
    const chapters = await payload.find({
      collection: 'chapters',
      limit: 1,
    })

    if (chapters.docs.length > 0) {
      testChapterId = chapters.docs[0].id
    } else {
      const chapter = await payload.create({
        collection: 'chapters',
        data: {
          title: 'Test Chapter for Lesson Context',
        },
        draft: true,
      })
      testChapterId = chapter.id
    }

    // Create lesson A with context text
    const lessonA = await payload.create({
      collection: 'lessons',
      data: {
        chapter: testChapterId,
        title: 'Lesson A with Context',
        lessonContextText: 'This is the context for Lesson A. It contains important information about algebra.',
        status: 'published',
        isActive: true,
        order: 0,
      } as any,
      draft: false,
    })
    testLessonId = lessonA.id

    // Create lesson B with different context text
    const lessonB = await payload.create({
      collection: 'lessons',
      data: {
        chapter: testChapterId,
        title: 'Lesson B with Context',
        lessonContextText: 'This is the context for Lesson B. It contains information about geometry.',
        status: 'published',
        isActive: true,
        order: 1,
      } as any,
      draft: false,
    })
    testLessonIdB = lessonB.id
  },
  60000,
)

afterAll(async () => {
  if (!payload) return

  if (testUserId) {
    await payload.delete({
      collection: 'users',
      id: testUserId,
    })
  }

  if (testLessonId) {
    await payload.delete({
      collection: 'lessons',
      id: testLessonId,
    })
  }

  if (testLessonIdB) {
    await payload.delete({
      collection: 'lessons',
      id: testLessonIdB,
    })
  }
}, 30000)

describe.skipIf(!hasDatabaseUrl)('Lesson Context Injection', () => {
  beforeEach(() => {
    vi.mocked(contextPolicy.composePrompt).mockClear()
  })

  it('should inject lessonContextText into composed prompt', async () => {
    const req = {
      payload,
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Hello, can you help me?',
        acknowledgment: 'ack-1',
        lessonId: testLessonId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)
    expect(res.status).toBe(200)

    // Verify composePrompt was called
    expect(vi.mocked(contextPolicy.composePrompt)).toHaveBeenCalled()

    // Get the system message passed to composePrompt
    const lastCall = vi.mocked(contextPolicy.composePrompt).mock.calls[
      vi.mocked(contextPolicy.composePrompt).mock.calls.length - 1
    ]
    const systemMessage = lastCall[0] as string

    // Verify lesson context is present in the system message
    expect(systemMessage).toContain(LESSON_CONTEXT_BLOCK_START)
    expect(systemMessage).toContain('This is the context for Lesson A')
    expect(systemMessage).toContain('important information about algebra')
  }, 60000)

  it('should NOT persist lessonContextText in messages', async () => {
    const req = {
      payload,
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'What is algebra?',
        acknowledgment: 'ack-2',
        lessonId: testLessonId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    // Verify conversation was created
    const conversation = await payload.findByID({
      collection: 'conversations',
      id: body.conversationId,
    })

    // Verify messages don't contain lesson context markers
    const messages = conversation.messages || []
    const allMessageContent = messages.map((m) => m.content || '').join(' ')

    expect(allMessageContent).not.toContain(LESSON_CONTEXT_BLOCK_START)
    expect(allMessageContent).not.toContain('This is the context for Lesson A')
  }, 60000)

  it('should inject only current lesson context', async () => {
    // Send message with Lesson A
    const reqA = {
      payload,
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Message for Lesson A',
        acknowledgment: 'ack-3',
        lessonId: testLessonId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    await agentChat(reqA)
    vi.mocked(contextPolicy.composePrompt).mockClear()

    // Send message with Lesson B
    const reqB = {
      payload,
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({
        message: 'Message for Lesson B',
        acknowledgment: 'ack-4',
        lessonId: testLessonIdB,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    await agentChat(reqB)

    // Verify composePrompt was called with Lesson B context
    expect(vi.mocked(contextPolicy.composePrompt)).toHaveBeenCalled()
    const lastCall = vi.mocked(contextPolicy.composePrompt).mock.calls[
      vi.mocked(contextPolicy.composePrompt).mock.calls.length - 1
    ]
    const systemMessage = lastCall[0] as string

    // Lesson B context should be present
    expect(systemMessage).toContain('This is the context for Lesson B')
    expect(systemMessage).toContain('information about geometry')

    // Lesson A context should NOT be present
    expect(systemMessage).not.toContain('This is the context for Lesson A')
  }, 60000)

  it('should reject oversized context without calling model', async () => {
    // Create a lesson with oversized context - should be rejected by Payload validation
    const oversizedContext = 'a'.repeat(LESSON_CONTEXT_MAX_CHARS + 1)

    // Payload field validation should reject oversized context (maxLength: 100_000)
    await expect(
      payload.create({
        collection: 'lessons',
        data: {
          chapter: testChapterId,
          title: 'Oversized Lesson',
          lessonContextText: oversizedContext,
          status: 'published',
          isActive: true,
          order: 2,
        } as any,
        draft: false,
      }),
    ).rejects.toThrow(/invalid/)
  }, 60000)

  it('should verify stored messages never contain lesson markers', async () => {
    // Send multiple messages to build conversation history
    const messages = ['Message 1', 'Message 2', 'Message 3']

    let conversationId: string | undefined

    for (const msg of messages) {
      const req = {
        payload,
        user: { id: testUserId } as PayloadRequest['user'],
        json: async () => ({
          message: msg,
          acknowledgment: `ack-${Date.now()}`,
          lessonId: testLessonId,
        }),
      } as unknown as PayloadRequest & { json: () => Promise<unknown> }

      const res = await agentChat(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      conversationId = body.conversationId
    }

    // Verify conversation messages don't contain lesson markers
    if (conversationId) {
      const conversation = await payload.findByID({
        collection: 'conversations',
        id: conversationId,
      })

      const allMessageContent = (conversation.messages || [])
        .map((m) => m.content || '')
        .join(' ')

      expect(allMessageContent).not.toContain(LESSON_CONTEXT_BLOCK_START)
    }
  }, 60000)
})

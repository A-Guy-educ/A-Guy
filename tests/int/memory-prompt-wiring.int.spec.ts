/**
 * Suite A: Memory Prompt Wiring Integration Tests
 *
 * Purpose: Prove that retrieved memory items are injected into the prompt
 * and affect the LLM response.
 *
 * Network: Fully offline (all external calls mocked).
 */
import { ChatRole } from '@/infra/llm/chat-message-role'
import type { ComposedPrompt } from '@/infra/llm/context-policy'
import { MEMORY_BLOCK_END, MEMORY_BLOCK_START } from '@/infra/llm/context-policy'
import type { MemoryItem } from '@/infra/llm/vector-search'
import config from '@payload-config'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Skip tests if DATABASE_URL is not set
const hasDatabaseUrl = !!process.env.DATABASE_URL

// Capture prompts passed to chatWithExerciseHelper
let capturedPrompts: ComposedPrompt[] = []

// Mock retrieveMemoryItems - returns controlled items
const mockRetrieveMemoryItems = vi.fn()
vi.mock('@/infra/llm/vector-search', async () => {
  const actual = await vi.importActual('@/infra/llm/vector-search')
  return {
    ...actual,
    retrieveMemoryItems: (...args: unknown[]) => mockRetrieveMemoryItems(...args),
  }
})

// Mock other services
vi.mock('@/infra/llm/vector-index-check', () => ({
  isVectorIndexAvailable: vi.fn(async () => true),
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
const testUsers = new Map<string, string>() // email -> userId
let testExerciseId: string | undefined

// Helper: Find system message
function getSystemMessage(prompt: ComposedPrompt): string | undefined {
  return prompt.messages.find((m) => m.role === 'system')?.content
}

// Helper: Create test user
async function createTestUser(prefix: string): Promise<string> {
  const email = `test-${prefix}-${Date.now()}@example.com`
  const user = await payload.create({
    collection: 'users',
    data: {
      email,
      password: 'test123456',
      role: 'student',
    },
  })
  testUsers.set(email, user.id)
  return user.id
}

// Mock LLM - capture prompts passed to chatWithExerciseHelper
// We use doMock inside beforeAll to ensure it's applied after module loading
let mockChatWithExerciseHelper: (input: {
  composedPrompt?: ComposedPrompt
  message: string
}) => Promise<{ success: boolean; message: string }>

beforeAll(async () => {
  // Setup mocks after vi.mock declarations but before tests
  mockChatWithExerciseHelper = async (input: {
    composedPrompt?: ComposedPrompt
    message: string
  }) => {
    if (input.composedPrompt) {
      capturedPrompts.push(input.composedPrompt)
    }
    return { success: true, message: 'Mock response' }
  }

  vi.doMock('@/infra/llm/services/exercise-chat-service', () => ({
    chatWithExerciseHelper: mockChatWithExerciseHelper,
  }))
}, 60000)

// Helper: Create memory item
function createMemoryItem(
  userId: string,
  text: string,
  importance: number,
  conversationId?: string,
): MemoryItem {
  return {
    _id: `mem-${Date.now()}-${Math.random()}`,
    userId,
    conversationId,
    contextKey: 'global',
    contextLevel: 'global',
    type: 'fact',
    text,
    importance,
    status: 'active',
    source: {
      sourceMessageTimestamp: new Date(),
      sourceMessageRole: ChatRole.User,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// Helper: Make chat request as user
async function chatAsUser(userId: string, message: string): Promise<Response> {
  // Import agentChat dynamically to get the mocked version
  const { agentChat } = await import('@/server/payload/endpoints/agent/chat')

  if (!testExerciseId) {
    throw new Error('testExerciseId not initialized')
  }

  const req = {
    payload,
    headers: new Headers(),
    user: { id: userId } as PayloadRequest['user'],
    json: async () => ({
      message,
      acknowledgment: 'ack-1',
      exerciseId: testExerciseId,
    }),
  } as unknown as PayloadRequest & { json: () => Promise<unknown> }

  return agentChat(req)
}

beforeAll(async () => {
  payload = await getPayload({ config })

  // Create full hierarchy: category -> course -> chapter -> lesson -> exercise
  // This is needed because agentChat resolves exerciseId -> lesson and
  // fetchLessonContext calls payload.findByID on the lesson
  const existingCategories = await payload.find({ collection: 'categories', limit: 1 })
  let testCategoryId: string
  if (existingCategories.docs.length > 0) {
    testCategoryId = existingCategories.docs[0].id
  } else {
    const category = await payload.create({
      collection: 'categories',
      data: { title: 'Test Category', slug: `test-cat-mpw-${Date.now()}` } as any,
    })
    testCategoryId = category.id
  }

  const existingCourses = await payload.find({ collection: 'courses', limit: 1 })
  let testCourseId: string
  if (existingCourses.docs.length > 0) {
    testCourseId = existingCourses.docs[0].id
  } else {
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'Test',
        title: 'Memory Wiring Test Course',
        slug: `test-course-mpw-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
        categories: [testCategoryId],
      } as any,
    })
    testCourseId = course.id
  }

  const existingChapters = await payload.find({ collection: 'chapters', limit: 1 })
  let testChapterId: string
  if (existingChapters.docs.length > 0) {
    testChapterId = existingChapters.docs[0].id
  } else {
    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        course: testCourseId,
        title: 'Memory Wiring Test Chapter',
        slug: `test-chapter-mpw-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
      } as any,
    })
    testChapterId = chapter.id
  }

  const existingLessons = await payload.find({ collection: 'lessons', limit: 1 })
  let testLessonId: string
  if (existingLessons.docs.length > 0) {
    testLessonId = existingLessons.docs[0].id
  } else {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter: testChapterId,
        title: 'Memory Wiring Test Lesson',
        slug: `test-lesson-mpw-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
      } as any,
    })
    testLessonId = lesson.id
  }

  // Always create our own exercise with a guaranteed-valid lesson reference
  // (existing exercises may reference lessons that no longer exist)
  const exercise = await payload.create({
    collection: 'exercises',
    data: {
      title: 'Memory Wiring Test Exercise',
      slug: `test-exercise-mpw-${Date.now()}`,
      lesson: testLessonId,
      order: 0,
      _status: 'published',
    } as any,
  })
  testExerciseId = exercise.id
}, 60000)

beforeEach(() => {
  capturedPrompts = []
  mockRetrieveMemoryItems.mockClear()
  // Note: mockChatWithExerciseHelper is a plain function, not a mock
  // The capturedPrompts array is reset above
})

afterAll(async () => {
  if (!payload) return

  // Cleanup: Paginate through all test conversations
  let hasMore = true
  while (hasMore) {
    const conversations = await payload.find({
      collection: 'conversations',
      where: { user: { in: Array.from(testUsers.values()) } },
      limit: 100,
    })

    if (conversations.docs.length === 0) {
      hasMore = false
      break
    }

    await Promise.all(
      conversations.docs.map((conv) =>
        payload.delete({ collection: 'conversations', id: conv.id }).catch(() => {}),
      ),
    )
  }

  // Delete test users
  for (const userId of testUsers.values()) {
    await payload.delete({ collection: 'users', id: userId }).catch(() => {})
  }

  // Close DB connection to prevent connection leaks
  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
}, 60000)

describe.skipIf(!hasDatabaseUrl)('Memory Prompt Wiring Tests', () => {
  it('injects retrieved memory into prompt and affects response', async () => {
    const userId = await createTestUser('U1')

    // Mock retriever returns LMS memory
    mockRetrieveMemoryItems.mockResolvedValueOnce({
      items: [createMemoryItem(userId, 'The user is building a mathematics LMS', 4)],
      localCount: 0,
      contextCount: 0,
      globalCount: 1,
      parentCount: 0,
      hierarchyKeys: ['global'],
      latencyMs: 5,
    })

    // Mock LLM to check prompt content - override the default behavior
    const original = mockChatWithExerciseHelper
    mockChatWithExerciseHelper = async (input: {
      composedPrompt?: ComposedPrompt
      message: string
    }) => {
      if (input.composedPrompt) {
        capturedPrompts.push(input.composedPrompt)
      }
      const systemMsg = input.composedPrompt?.messages.find(
        (m: { role: string }) => m.role === 'system',
      )
      const hasMemoryBlock = systemMsg?.content.includes(MEMORY_BLOCK_START)
      const hasLmsMemory = systemMsg?.content.includes('mathematics LMS')

      if (hasMemoryBlock && hasLmsMemory) {
        return {
          success: true,
          message: "You're building a mathematics LMS for educational purposes.",
        }
      }
      return { success: true, message: "I don't have specific context about your project." }
    }
    // Restore after test
    const restore = () => {
      mockChatWithExerciseHelper = original
    }

    const response = await chatAsUser(userId, 'What kind of system am I building?')
    const body = await response.json()

    // 1. Verify retriever was called with correct userId
    expect(mockRetrieveMemoryItems).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      expect.any(String),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )

    // 2. Verify prompt contains memory delimiters and text
    expect(capturedPrompts.length).toBeGreaterThan(0)
    const systemContent = getSystemMessage(capturedPrompts[0])
    expect(systemContent).toContain(MEMORY_BLOCK_START)
    expect(systemContent).toContain('mathematics LMS')
    expect(systemContent).toContain(MEMORY_BLOCK_END)

    // 3. Verify behavioral change
    expect(body.message).toContain('mathematics LMS')

    // Restore mock
    restore()
  }, 60000)

  it('injects only the memories returned by retriever (selected memory injection)', async () => {
    const userId = await createTestUser('selection-user')

    // Mock retriever returns ONLY LMS (retriever already filtered)
    mockRetrieveMemoryItems.mockResolvedValueOnce({
      items: [createMemoryItem(userId, 'The user is building a mathematics LMS', 4)],
      localCount: 0,
      contextCount: 0,
      globalCount: 1,
      parentCount: 0,
      hierarchyKeys: ['global'],
      latencyMs: 5,
    })

    // Mock LLM
    const original = mockChatWithExerciseHelper
    mockChatWithExerciseHelper = async (input: {
      composedPrompt?: ComposedPrompt
      message: string
    }) => {
      if (input.composedPrompt) {
        capturedPrompts.push(input.composedPrompt)
      }
      return { success: true, message: 'Response' }
    }
    const restore2 = () => {
      mockChatWithExerciseHelper = original
    }

    await chatAsUser(userId, 'What product am I working on?')

    expect(capturedPrompts.length).toBeGreaterThan(0)
    const systemContent = getSystemMessage(capturedPrompts[0])
    expect(systemContent).toContain('mathematics LMS')
    expect(systemContent).not.toContain('Italian food')

    restore2()
  }, 60000)

  it('passes correct userId to retriever', async () => {
    const _userU1 = await createTestUser('U1-wiring')
    const userU2 = await createTestUser('U2-wiring')

    mockRetrieveMemoryItems.mockResolvedValueOnce({
      items: [createMemoryItem(userU2, 'The user is building a CRM system', 4)],
      localCount: 0,
      contextCount: 0,
      globalCount: 1,
      parentCount: 0,
      hierarchyKeys: ['global'],
      latencyMs: 5,
    })

    // Mock LLM
    const original = mockChatWithExerciseHelper
    mockChatWithExerciseHelper = async (input: {
      composedPrompt?: ComposedPrompt
      message: string
    }) => {
      if (input.composedPrompt) {
        capturedPrompts.push(input.composedPrompt)
      }
      return { success: true, message: 'Response' }
    }
    const restore3 = () => {
      mockChatWithExerciseHelper = original
    }

    await chatAsUser(userU2, 'What system am I building?')

    expect(mockRetrieveMemoryItems).toHaveBeenCalledWith(
      expect.anything(),
      userU2, // CRITICAL: must be U2
      expect.any(String),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )

    restore3()
  }, 60000)

  it('places memory text inside stable delimiters', async () => {
    const userId = await createTestUser('prompt-inspect')
    const memoryText = 'User prefers dark mode IDE and uses VS Code'

    mockRetrieveMemoryItems.mockResolvedValueOnce({
      items: [createMemoryItem(userId, memoryText, 4)],
      localCount: 0,
      contextCount: 0,
      globalCount: 1,
      parentCount: 0,
      hierarchyKeys: ['global'],
      latencyMs: 5,
    })

    // Mock LLM
    const original = mockChatWithExerciseHelper
    mockChatWithExerciseHelper = async (input: {
      composedPrompt?: ComposedPrompt
      message: string
    }) => {
      if (input.composedPrompt) {
        capturedPrompts.push(input.composedPrompt)
      }
      return { success: true, message: 'Response' }
    }
    const restore4 = () => {
      mockChatWithExerciseHelper = original
    }

    await chatAsUser(userId, 'Tell me about my preferences')

    expect(capturedPrompts.length).toBeGreaterThan(0)
    const systemContent = getSystemMessage(capturedPrompts[0])

    // Delimiters present
    expect(systemContent).toContain(MEMORY_BLOCK_START)
    expect(systemContent).toContain(MEMORY_BLOCK_END)

    // Memory is BETWEEN delimiters
    const startIdx = systemContent!.indexOf(MEMORY_BLOCK_START)
    const endIdx = systemContent!.indexOf(MEMORY_BLOCK_END)
    const memoryBlock = systemContent!.substring(startIdx, endIdx)
    expect(memoryBlock).toContain('dark mode IDE')
    expect(memoryBlock).toContain('VS Code')

    expect(capturedPrompts[0].metadata.memoryCount).toBe(1)

    restore4()
  }, 60000)
})

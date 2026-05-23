/**
 * Integration tests for /api/agent/message/persist endpoint
 *
 * Tests:
 * - Persisting a message creates a conversation if none exists (bug #1847)
 * - Persisting a message to an existing conversation works correctly
 * - Returns 401 when unauthenticated
 */
import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Awaited<ReturnType<typeof getPayload>>
let testUserId: string
let testLessonId: string
let testContextKey: string
let testUserToken: string

// Helper to create a mock NextRequest with optional auth header
function createMockNextRequest(body: Record<string, unknown>, authToken?: string) {
  const headers = new Headers()
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }
  return {
    json: async () => body,
    headers,
  } as unknown as {
    json: () => Promise<Record<string, unknown>>
    headers: Headers
  }
}

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Create test user
  const testEmail = `persist-test-${Date.now()}@example.com`
  const user = await payload.create({
    collection: 'users',
    data: {
      email: testEmail,
      password: 'test123456',
      role: 'student',
    },
  })
  testUserId = user.id

  // Login to get a token for auth
  const loginResult = await payload.login({
    collection: 'users',
    data: {
      email: testEmail,
      password: 'test123456',
    },
  })
  testUserToken = loginResult.token as string

  // Get or create a lesson for the test contextKey
  const existingLessons = await payload.find({
    collection: 'lessons',
    limit: 1,
  })

  if (existingLessons.docs.length > 0) {
    testLessonId = existingLessons.docs[0].id
  } else {
    // Need a minimal hierarchy: category -> course -> chapter -> lesson
    const category = await payload.create({
      collection: 'categories',
      data: { title: 'Persist Test Category', slug: `persist-test-cat-${Date.now()}` },
    } as any)
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'PT',
        title: 'Persist Test Course',
        slug: `persist-test-course-${Date.now()}`,
        categories: [category.id],
        order: 1,
        status: 'published',
        isActive: true,
      },
      draft: true,
    } as any)
    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        chapterLabel: '1',
        title: 'Persist Test Chapter',
        slug: `persist-test-chapter-${Date.now()}`,
        course: course.id,
        order: 1,
        status: 'published',
        isActive: true,
      },
      draft: true,
    } as any)
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Persist Test Lesson',
        chapter: chapter.id,
        order: 1,
        status: 'published',
      },
      draft: true,
    } as any)
    testLessonId = lesson.id
  }

  testContextKey = `lessons:${testLessonId}`
}, 60000)

afterAll(async () => {
  if (!payload || !testUserId) return

  // Delete test conversation if it exists
  const conversations = await payload.find({
    collection: 'conversations',
    where: { user: { equals: testUserId } },
    limit: 100,
    overrideAccess: true,
  })
  for (const conv of conversations.docs) {
    await payload.delete({ collection: 'conversations', id: conv.id, overrideAccess: true })
  }

  // Delete test user
  await payload.delete({ collection: 'users', id: testUserId })

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
}, 30000)

describe.skipIf(!hasDatabaseUrl)('POST /api/agent/message/persist', () => {
  it('returns 401 when not authenticated and no guest session', async () => {
    const { POST } = await import('@/app/api/agent/message/persist/route')

    const mockReq = createMockNextRequest({
      contextKey: testContextKey,
      content: 'Test message content',
    })

    const res = await POST(mockReq as any)
    expect(res.status).toBe(401)
  })

  it('creates a conversation and persists message when no conversation exists (bug #1847 fix)', async () => {
    // Use testLessonId (a real lesson with valid chapter) but a unique contextKey
    // so no prior conversation exists. Using a fake lesson ID fails Payload
    // relationship validation (500), so we use the real testLessonId instead.
    const uniqueContextKey = `lessons:${testLessonId}-unique-${Date.now()}`

    const { POST } = await import('@/app/api/agent/message/persist/route')

    const req = createMockNextRequest(
      {
        contextKey: uniqueContextKey,
        content: 'Test content for newly created conversation',
      },
      testUserToken,
    )

    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)

    // Verify the conversation was created and message was persisted
    const conversations = await payload.find({
      collection: 'conversations',
      where: {
        and: [
          { user: { equals: testUserId } },
          { contextKey: { equals: uniqueContextKey } },
          { archivedAt: { exists: false } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    expect(conversations.docs.length).toBe(1)
    expect(conversations.docs[0].messages).toHaveLength(1)
    expect((conversations.docs[0].messages as any)[0].content).toBe(
      'Test content for newly created conversation',
    )

    // Cleanup
    await payload.delete({
      collection: 'conversations',
      id: conversations.docs[0].id,
      overrideAccess: true,
    })
  })

  it('persists message to an existing conversation successfully', async () => {
    // First create a conversation for this contextKey
    const conversation = await payload.create({
      collection: 'conversations',
      data: {
        user: testUserId,
        contextKey: testContextKey,
        contextRef: {
          relationTo: 'lessons',
          value: testLessonId,
        },
        messages: [],
        lastMessageAt: new Date(),
        contextPolicyVersion: 'v1',
      },
      overrideAccess: true,
    } as any)

    const { POST } = await import('@/app/api/agent/message/persist/route')

    const mockReq = createMockNextRequest(
      {
        contextKey: testContextKey,
        content: 'Persisted guiding question content',
      },
      testUserToken,
    )

    const res = await POST(mockReq as any)

    // Clean up the conversation we created
    await payload.delete({ collection: 'conversations', id: conversation.id, overrideAccess: true })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

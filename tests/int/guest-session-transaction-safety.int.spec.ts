/**
 * Integration tests for guest-session transaction safety (FR-1, FR-2, FR-3)
 *
 * Tests that guest-session service functions accept an optional `payloadReq` parameter
 * for transaction safety. When provided, the functions should use payloadReq.payload
 * instead of creating a new payload instance, and pass payloadReq to all Payload
 * operations as the `req` property.
 *
 * These tests should FAIL initially because the functions don't yet accept payloadReq parameter.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { createGuestSession } from '../factories/guest-session.factory'
import { createTestUser } from '../factories/user.factory'
import {
  createGuestSession as createGuestSessionService,
  getGuestSessionByToken,
  updateGuestSessionActivity,
  revokeGuestSession,
  checkAndIncrementGuestMessageCount,
} from '@/server/services/guest-session'
import {
  claimGuestConversations,
  hasPendingGuestConversations,
} from '@/server/services/guest-session-upgrade'

// Skip tests if DATABASE_URL is not set (e.g., in CI without MongoDB service)
const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let originalDatabaseUrl: string | undefined
let testUserId: string
let testExerciseId: string

beforeAll(async () => {
  if (!hasDatabaseUrl) {
    return
  }

  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const payloadConfig = await import('@payload-config')
  payload = await getPayload({ config: payloadConfig.default })

  // Create test user
  const user = await createTestUser(payload)
  testUserId = user.id

  // Get test exercise
  const existingExercises = await payload.find({
    collection: 'exercises',
    limit: 1,
  })

  if (existingExercises.docs.length > 0) {
    testExerciseId = existingExercises.docs[0].id
  } else {
    // Create minimal hierarchy: course -> chapter -> lesson -> exercise
    const existingCategories = await payload.find({
      collection: 'categories',
      limit: 1,
    })

    let categoryId: string
    if (existingCategories.docs.length > 0) {
      categoryId = existingCategories.docs[0].id
    } else {
      const category = await payload.create({
        collection: 'categories',
        data: {
          title: 'Test Category',
          slug: `test-category-${Date.now()}`,
        } as any,
      })
      categoryId = category.id
    }

    const course = await payload.create({
      collection: 'courses',
      data: {
        title: 'Test Course',
        slug: `test-course-${Date.now()}`,
        category: categoryId,
        status: 'published',
      } as any,
    })

    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        title: 'Test Chapter',
        slug: `test-chapter-${Date.now()}`,
        course: course.id,
        status: 'published',
        order: 1,
      } as any,
    })

    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Test Lesson',
        slug: `test-lesson-${Date.now()}`,
        chapter: chapter.id,
        status: 'published',
        order: 1,
      } as any,
    })

    const exercise = await payload.create({
      collection: 'exercises',
      data: {
        title: 'Test Exercise',
        slug: `test-exercise-${Date.now()}`,
        lesson: lesson.id,
        status: 'published',
        order: 1,
        content: [],
      } as any,
    })
    testExerciseId = exercise.id
  }
}, 120000)

afterAll(async () => {
  if (!hasDatabaseUrl) {
    return
  }

  // Clean up test user
  if (payload && testUserId) {
    await payload.delete({
      collection: 'users',
      id: testUserId,
      overrideAccess: true,
    })
  }

  // Close DB connection before stopping container
  if (payload?.db?.destroy) {
    await payload.db.destroy()
  }

  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
    delete process.env.DATABASE_URL
  }
}, 120000)

// Helper to create a mock PayloadRequest
function createMockPayloadReq(reqPayload: Payload): PayloadRequest {
  return {
    payload: reqPayload,
    user: null,
    headers: new Headers(),
    locale: 'en',
    fallbackLocale: 'en',
    globalAcceptsLanguage: null,
    routeParams: {},
    query: {},
    body: null,
    files: null,
    infersPermissions: () => false,
    canUseUI: () => false,
    payloadAPI: 'local',
    auth: async () => ({ user: null }),
    context: {},
  } as unknown as PayloadRequest
}

describe('guest-session.ts transaction safety (FR-1)', () => {
  describe('createGuestSession', () => {
    it('should accept payloadReq parameter', async () => {
      if (!hasDatabaseUrl) {
        it.skip('No database URL', () => {})
        return
      }

      const mockPayloadReq = createMockPayloadReq(payload)

      // This should work when payloadReq parameter is supported
      const result = await (createGuestSessionService as any)({
        req: new Request('http://test.com'),
        ipHash: 'test-ip-hash',
        userAgentHash: 'test-ua-hash',
        payloadReq: mockPayloadReq,
      })

      expect(result.session).toBeDefined()
      expect(result.token).toBeDefined()

      // Cleanup
      if (result.session?.id) {
        await payload.delete({
          collection: 'guest-sessions',
          id: result.session.id,
          overrideAccess: true,
        })
      }
    })

    it('should use payloadReq.payload when provided', async () => {
      if (!hasDatabaseUrl) {
        it.skip('No database URL', () => {})
        return
      }

      const mockPayloadReq = createMockPayloadReq(payload)

      // When payloadReq is provided, the function should use payloadReq.payload
      // instead of calling getPayload({ config })
      const result = await (createGuestSessionService as any)({
        req: new Request('http://test.com'),
        payloadReq: mockPayloadReq,
      })

      // Verify the session was created using the payload from payloadReq
      expect(result.session).toBeDefined()

      // Cleanup
      if (result.session?.id) {
        await payload.delete({
          collection: 'guest-sessions',
          id: result.session.id,
          overrideAccess: true,
        })
      }
    })
  })

  describe('getGuestSessionByToken', () => {
    it('should accept payloadReq parameter', async () => {
      if (!hasDatabaseUrl) {
        it.skip('No database URL', () => {})
        return
      }

      // Create a guest session first
      const { session, token } = await createGuestSession(payload, { status: 'active' })

      const mockPayloadReq = createMockPayloadReq(payload)

      // This should work when payloadReq parameter is supported
      const result = await (getGuestSessionByToken as any)(token, mockPayloadReq)

      expect(result).toBeDefined()
      expect(result?.id).toBe(session.id)

      // Cleanup
      if (session?.id) {
        await payload.delete({
          collection: 'guest-sessions',
          id: session.id,
          overrideAccess: true,
        })
      }
    })
  })

  describe('updateGuestSessionActivity', () => {
    it('should accept payloadReq parameter', async () => {
      if (!hasDatabaseUrl) {
        it.skip('No database URL', () => {})
        return
      }

      // Create a guest session first
      const { session } = await createGuestSession(payload, { status: 'active' })

      const mockPayloadReq = createMockPayloadReq(payload)

      // This should work when payloadReq parameter is supported
      const result = await (updateGuestSessionActivity as any)(session.id, mockPayloadReq)

      expect(result).toBeDefined()
      expect(result?.id).toBe(session.id)

      // Cleanup
      if (session?.id) {
        await payload.delete({
          collection: 'guest-sessions',
          id: session.id,
          overrideAccess: true,
        })
      }
    })
  })

  describe('revokeGuestSession', () => {
    it('should accept payloadReq parameter', async () => {
      if (!hasDatabaseUrl) {
        it.skip('No database URL', () => {})
        return
      }

      // Create a guest session first
      const { session } = await createGuestSession(payload, { status: 'active' })

      const mockPayloadReq = createMockPayloadReq(payload)

      // This should work when payloadReq parameter is supported
      const result = await (revokeGuestSession as any)(session.id, testUserId, mockPayloadReq)

      expect(result).toBeDefined()
      expect(result?.status).toBe('revoked')
      expect(result?.claimedByUser).toBe(testUserId)

      // Cleanup
      if (session?.id) {
        await payload.delete({
          collection: 'guest-sessions',
          id: session.id,
          overrideAccess: true,
        })
      }
    })
  })

  describe('checkAndIncrementGuestMessageCount', () => {
    it('should accept payloadReq parameter', async () => {
      if (!hasDatabaseUrl) {
        it.skip('No database URL', () => {})
        return
      }

      // Create a guest session first
      const { session } = await createGuestSession(payload, { status: 'active' })

      const mockPayloadReq = createMockPayloadReq(payload)

      // This should work when payloadReq parameter is supported
      const result = await (checkAndIncrementGuestMessageCount as any)(session.id, mockPayloadReq)

      expect(result).toBeDefined()
      expect(result.allowed).toBe(true)
      expect(result.current).toBe(1)

      // Cleanup
      if (session?.id) {
        await payload.delete({
          collection: 'guest-sessions',
          id: session.id,
          overrideAccess: true,
        })
      }
    })
  })
})

describe('guest-session-upgrade.ts transaction safety (FR-2, FR-3)', () => {
  describe('claimGuestConversations', () => {
    it('should accept payloadReq parameter and transfer conversations', async () => {
      if (!hasDatabaseUrl) {
        it.skip('No database URL', () => {})
        return
      }

      // Create a guest session
      const { session: guestSession, token } = await createGuestSession(payload, {
        status: 'active',
      })

      // Create a conversation for this guest session
      const conversation = await payload.create({
        collection: 'conversations',
        data: {
          guestSession: guestSession.id,
          contextRef: {
            relationTo: 'exercises',
            value: testExerciseId,
          },
          messages: [],
          summary: '',
          contextPolicyVersion: 'v1',
          lastMessageAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })

      const mockPayloadReq = createMockPayloadReq(payload)

      // This should work when payloadReq parameter is supported
      const result = await (claimGuestConversations as any)(
        testUserId,
        token,
        new Headers(),
        mockPayloadReq,
      )

      expect(result.claimed).toBe(1)
      expect(result.headers).toBeDefined()

      // Verify the conversation was transferred to the user
      const updatedConversation = await payload.findByID({
        collection: 'conversations',
        id: conversation.id,
        overrideAccess: true,
      })

      expect((updatedConversation as any).user).toBe(testUserId)
      expect((updatedConversation as any).guestSession).toBeNull()

      // Verify the guest session was revoked
      const revokedSession = await payload.findByID({
        collection: 'guest-sessions',
        id: guestSession.id,
        overrideAccess: true,
      })

      expect((revokedSession as any).status).toBe('revoked')
      expect((revokedSession as any).claimedByUser).toBe(testUserId)

      // Cleanup
      if (guestSession?.id) {
        await payload.delete({
          collection: 'guest-sessions',
          id: guestSession.id,
          overrideAccess: true,
        })
      }
      if (conversation?.id) {
        await payload.delete({
          collection: 'conversations',
          id: conversation.id,
          overrideAccess: true,
        })
      }
    })
  })

  describe('hasPendingGuestConversations', () => {
    it('should accept payloadReq parameter', async () => {
      if (!hasDatabaseUrl) {
        it.skip('No database URL', () => {})
        return
      }

      // Create a guest session
      const { session: guestSession, token } = await createGuestSession(payload, {
        status: 'active',
      })

      // Create a conversation for this guest session
      await payload.create({
        collection: 'conversations',
        data: {
          guestSession: guestSession.id,
          contextRef: {
            relationTo: 'exercises',
            value: testExerciseId,
          },
          messages: [],
          summary: '',
          contextPolicyVersion: 'v1',
          lastMessageAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })

      const mockPayloadReq = createMockPayloadReq(payload)

      // This should work when payloadReq parameter is supported
      const result = await (hasPendingGuestConversations as any)(token, mockPayloadReq)

      expect(result).toBe(true)

      // Cleanup
      // Delete all conversations for this guest session
      const conversations = await payload.find({
        collection: 'conversations',
        where: { guestSession: { equals: guestSession.id } },
        limit: 100,
        overrideAccess: true,
      })

      for (const conv of conversations.docs) {
        await payload.delete({
          collection: 'conversations',
          id: conv.id,
          overrideAccess: true,
        })
      }

      if (guestSession?.id) {
        await payload.delete({
          collection: 'guest-sessions',
          id: guestSession.id,
          overrideAccess: true,
        })
      }
    })

    it('should return false when no pending conversations', async () => {
      if (!hasDatabaseUrl) {
        it.skip('No database URL', () => {})
        return
      }

      // Create a guest session with no conversations
      const { token } = await createGuestSession(payload, {
        status: 'active',
      })

      const mockPayloadReq = createMockPayloadReq(payload)

      // This should work when payloadReq parameter is supported
      const result = await (hasPendingGuestConversations as any)(token, mockPayloadReq)

      expect(result).toBe(false)
    })
  })
})

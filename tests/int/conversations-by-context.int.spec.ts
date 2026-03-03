/**
 * Integration tests for /api/conversations/by-context DELETE endpoint
 *
 * Tests:
 * - DELETE endpoint should not allow user to archive another user's conversation
 *
 * This is a SECURITY TEST to ensure the DELETE endpoint enforces ownership
 * before allowing archival of conversations.
 *
 * PREREQUISITE: Must have DATABASE_URL and SERVER_URL set to test the API endpoint
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConversationService } from '@/server/services/conversation-service'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

// Skip tests if DATABASE_URL is not set (e.g., in CI without MongoDB service)
const hasDatabaseUrl = !!process.env.DATABASE_URL

// These tests require a running Next.js server - skip if not available
const hasServerUrl = !!process.env.SERVER_URL

let testUserAId: string
let testUserBId: string
let _testConversationId: string
let testExerciseId: string

// Store tokens for cleanup
const createdUsers: string[] = []
const createdConversations: string[] = []

beforeAll(async () => {
  if (!hasDatabaseUrl) {
    return
  }

  payload = await getPayload({ config })

  // Create user A
  const userA = await payload.create({
    collection: 'users',
    data: {
      email: `conversations-by-context-userA-${Date.now()}@example.com`,
      password: 'test123456',
      role: 'student',
    },
  })
  testUserAId = userA.id
  createdUsers.push(userA.id)

  // Create user B
  const userB = await payload.create({
    collection: 'users',
    data: {
      email: `conversations-by-context-userB-${Date.now()}@example.com`,
      password: 'test123456',
      role: 'student',
    },
  })
  testUserBId = userB.id
  createdUsers.push(userB.id)

  // Get or create test exercise for conversation context
  const existingExercises = await payload.find({
    collection: 'exercises',
    limit: 1,
  })

  if (existingExercises.docs.length > 0) {
    testExerciseId = existingExercises.docs[0].id
  } else {
    // Need full hierarchy: course -> chapter -> lesson -> exercise
    let exerciseCourseId: string
    let exerciseChapterId: string
    let exerciseLessonId: string

    // Get or create category (required for courses)
    const existingCategories = await payload.find({
      collection: 'categories',
      limit: 1,
    })

    let exerciseCategoryId: string
    if (existingCategories.docs.length > 0) {
      exerciseCategoryId = existingCategories.docs[0].id
    } else {
      const category = await payload.create({
        collection: 'categories',
        data: {
          title: 'Test Category',
          slug: `test-category-${Date.now()}`,
          locale: 'he',
        },
      })
      exerciseCategoryId = category.id
    }

    // Get or create course
    const existingCourses = await payload.find({
      collection: 'courses',
      limit: 1,
    })

    if (existingCourses.docs.length > 0) {
      exerciseCourseId = existingCourses.docs[0].id
    } else {
      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'Test',
          title: 'Conversations By Context Test Course',
          slug: `conversations-by-context-${Date.now()}`,
          order: 0,
          status: 'published',
          isActive: true,
          categories: [exerciseCategoryId],
        } as any,
      })
      exerciseCourseId = course.id
    }

    // Get or create chapter
    const existingChapters = await payload.find({
      collection: 'chapters',
      limit: 1,
    })

    if (existingChapters.docs.length > 0) {
      exerciseChapterId = existingChapters.docs[0].id
    } else {
      const chapter = await payload.create({
        collection: 'chapters',
        data: {
          course: exerciseCourseId,
          title: 'Conversations By Context Test Chapter',
          slug: `conversations-by-context-${Date.now()}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })
      exerciseChapterId = chapter.id
    }

    // Get or create lesson
    const existingLessons = await payload.find({
      collection: 'lessons',
      limit: 1,
    })

    if (existingLessons.docs.length > 0) {
      exerciseLessonId = existingLessons.docs[0].id
    } else {
      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          chapter: exerciseChapterId,
          title: 'Conversations By Context Test Lesson',
          slug: `conversations-by-context-${Date.now()}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })
      exerciseLessonId = lesson.id
    }

    const exercise = await payload.create({
      collection: 'exercises',
      data: {
        title: 'Conversations By Context Test Exercise',
        slug: `conversations-by-context-${Date.now()}`,
        lesson: exerciseLessonId,
        order: 0,
        _status: 'published',
      } as any,
    })
    testExerciseId = exercise.id
  }
})

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) {
    return
  }

  // Clean up test conversations
  for (const convId of createdConversations) {
    try {
      await payload.delete({
        collection: 'conversations',
        id: convId,
        overrideAccess: true,
      })
    } catch {
      // Ignore cleanup errors
    }
  }

  // Clean up test users
  for (const userId of createdUsers) {
    try {
      await payload.delete({
        collection: 'users',
        id: userId,
        overrideAccess: true,
      })
    } catch {
      // Ignore cleanup errors
    }
  }

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
})

describe.skipIf(!hasDatabaseUrl || !hasServerUrl)(
  'DELETE /api/conversations/by-context - Ownership Security',
  () => {
    it('should NOT allow userB to archive userA conversation - security test', async () => {
      // This test MUST FAIL before the fix (because DELETE uses overrideAccess: true)
      // This test MUST PASS after the fix (because overrideAccess: false enforces isOwner)

      const service = new ConversationService(payload)

      // Step 1: Create a conversation owned by userA
      const conversation = await service.getOrCreateActiveConversation(testUserAId, {
        relationTo: 'exercises',
        value: testExerciseId,
      })
      createdConversations.push(conversation.id)

      // Verify the conversation was created and is owned by userA
      const verifyConv = await payload.findByID({
        collection: 'conversations',
        id: conversation.id,
        overrideAccess: true,
      })
      expect(verifyConv).toBeDefined()
      expect(verifyConv.user).toBe(testUserAId)
      expect((verifyConv as any).archivedAt).toBeUndefined()

      // Step 2: Authenticate as userB and get JWT token
      // Get the user B object to find email
      const userBObj = await payload.findByID({
        collection: 'users',
        id: testUserBId,
        overrideAccess: true,
      })

      const loginForUserB = await payload.login({
        collection: 'users',
        data: {
          email: (userBObj as any).email,
          password: 'test123456',
        },
      })

      const userBToken = loginForUserB.token
      expect(userBToken).toBeDefined()

      // Step 3: Attempt to DELETE userA's conversation as userB
      // This should fail with 403 Forbidden because userB doesn't own the conversation
      const serverUrl = process.env.SERVER_URL || 'http://localhost:3000'
      const deleteResponse = await fetch(
        `${serverUrl}/api/conversations/by-context?id=${conversation.id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userBToken}`,
          },
        },
      )

      // Step 4: Verify the request was denied
      // Expected: 403 Forbidden or 404 Not Found (either is acceptable for access denied)
      expect(deleteResponse.status).toMatch(/403|404/)

      // Step 5: Verify the conversation was NOT archived (still exists and is active)
      const convAfterAttempt = await payload.findByID({
        collection: 'conversations',
        id: conversation.id,
        overrideAccess: true,
      })

      // The conversation should still be active (not archived)
      expect((convAfterAttempt as any).archivedAt).toBeUndefined()
    })

    it('should allow userA to archive their own conversation', async () => {
      // This test verifies that the endpoint works correctly for the owner

      const service = new ConversationService(payload)

      // Create a new conversation for userA
      const conversation = await service.getOrCreateActiveConversation(testUserAId, {
        relationTo: 'exercises',
        value: testExerciseId,
      })
      createdConversations.push(conversation.id)

      // Authenticate as userA
      const userAObj = await payload.findByID({
        collection: 'users',
        id: testUserAId,
        overrideAccess: true,
      })

      const loginForUserA = await payload.login({
        collection: 'users',
        data: {
          email: (userAObj as any).email,
          password: 'test123456',
        },
      })

      const userAToken = loginForUserA.token
      expect(userAToken).toBeDefined()

      // Attempt to DELETE own conversation - should succeed
      const serverUrl = process.env.SERVER_URL || 'http://localhost:3000'
      const deleteResponse = await fetch(
        `${serverUrl}/api/conversations/by-context?id=${conversation.id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userAToken}`,
          },
        },
      )

      // Expected: 200 Success (owner can archive their own conversation)
      expect(deleteResponse.status).toBe(200)

      // Verify the conversation was archived
      const convAfterArchive = await payload.findByID({
        collection: 'conversations',
        id: conversation.id,
        overrideAccess: true,
      })

      expect((convAfterArchive as any).archivedAt).toBeDefined()
    })
  },
)

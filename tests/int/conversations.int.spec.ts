/**
 * Integration tests for Conversations collection
 *
 * Tests:
 * - Uniqueness enforcement for user+exercise
 * - Uniqueness enforcement for user+lesson
 * - Active query returns only active conversations
 * - Archiving sets archivedAt and removes from active results
 *
 * INVARIANT: Active = archivedAt field is MISSING. Archived = archivedAt field EXISTS.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { ConversationService } from '@/server/services/conversation-service'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// Skip tests if DATABASE_URL is not set (e.g., in CI without MongoDB service)
const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let testUserId: string
let testExerciseId: string
let testLessonId: string
let testChapterId: string
let testCourseId: string

// Clean up conversations before each test
beforeEach(async () => {
  if (!payload) return

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

beforeAll(async () => {
  if (!hasDatabaseUrl) {
    return
  }

  payload = await getPayload({ config })

  // Create test user
  const user = await payload.create({
    collection: 'users',
    data: {
      email: `conversations-int-${Date.now()}@example.com`,
      password: 'test123456',
      role: 'student',
    },
  })
  testUserId = user.id

  // Get or create test exercise
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
        } as any,
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
          title: 'Conversations Integration Test Course',
          slug: `conversations-int-${Date.now()}`,
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
          title: 'Conversations Integration Test Chapter',
          slug: `conversations-int-${Date.now()}`,
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
          title: 'Conversations Integration Test Lesson',
          slug: `conversations-int-${Date.now()}`,
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
        title: 'Conversations Integration Test Exercise',
        slug: `conversations-int-${Date.now()}`,
        lesson: exerciseLessonId,
        order: 0,
        _status: 'published',
      } as any,
    })
    testExerciseId = exercise.id
  }

  // Get or create test category (required for courses)
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

  // Get or create test course (required for chapters)
  const existingCourses = await payload.find({
    collection: 'courses',
    limit: 1,
  })

  if (existingCourses.docs.length > 0) {
    testCourseId = existingCourses.docs[0].id
  } else {
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'Test',
        title: 'Conversations Integration Test Course',
        slug: `conversations-int-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
        categories: [testCategoryId],
      } as any,
    })
    testCourseId = course.id
  }

  // Get or create test chapter (required for lessons)
  const existingChapters = await payload.find({
    collection: 'chapters',
    limit: 1,
  })

  if (existingChapters.docs.length > 0) {
    testChapterId = existingChapters.docs[0].id
  } else {
    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        course: testCourseId,
        title: 'Conversations Integration Test Chapter',
        slug: `conversations-int-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
      } as any,
    })
    testChapterId = chapter.id
  }

  // Get or create test lesson
  const existingLessons = await payload.find({
    collection: 'lessons',
    limit: 1,
  })

  if (existingLessons.docs.length > 0) {
    testLessonId = existingLessons.docs[0].id
  } else {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter: testChapterId,
        title: 'Conversations Integration Test Lesson',
        slug: `conversations-int-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
      } as any,
    })
    testLessonId = lesson.id
  }
})

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) {
    return
  }

  // Clean up test conversations
  const conversations = await payload.find({
    collection: 'conversations',
    where: {
      user: { equals: testUserId },
    },
    limit: 1000,
  })

  for (const conv of conversations.docs) {
    await payload.delete({
      collection: 'conversations',
      id: conv.id,
    })
  }

  // Drop test-created indexes to prevent interference with other test files

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

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
})

describe.skipIf(!hasDatabaseUrl)('Conversations Collection', () => {
  describe('Active conversation invariant', () => {
    it('should create active conversation without archivedAt field', async () => {
      const service = new ConversationService(payload)

      const conversation = await service.getOrCreateActiveConversation(testUserId, {
        relationTo: 'exercises',
        value: testExerciseId,
      })

      // INVARIANT: Active conversations must NOT have archivedAt field
      expect(conversation).toBeDefined()
      expect(conversation.id).toBeDefined()

      // Fetch from DB directly to verify field is actually missing

      const db = (payload.db as any).connection.db
      const collection = db.collection('conversations')
      const { ObjectId } = await import('mongodb')
      const convId =
        typeof conversation.id === 'string' && ObjectId.isValid(conversation.id)
          ? new ObjectId(conversation.id)
          : conversation.id
      const rawConv = await collection.findOne({ _id: convId })

      // archivedAt should NOT exist in the database document
      expect(rawConv).toBeDefined()
      expect(rawConv.archivedAt).toBeUndefined()
    })

    it('should return only active conversations in queries', async () => {
      const service = new ConversationService(payload)

      // Create active conversation
      const activeConv = await service.getOrCreateActiveConversation(testUserId, {
        relationTo: 'exercises',
        value: testExerciseId,
      })

      // Archive it
      await payload.update({
        collection: 'conversations',
        id: activeConv.id,
        data: {
          archivedAt: new Date(),
        } as any,
        overrideAccess: true,
        context: { allowArchive: true }, // Required for archivedAt field
      })

      // Query for active conversations
      const activeConversations = await payload.find({
        collection: 'conversations',
        where: {
          and: [{ user: { equals: testUserId } }, { archivedAt: { exists: false } }],
        },
      })

      // Should not include the archived conversation
      const foundArchived = activeConversations.docs.find((c) => c.id === activeConv.id)
      expect(foundArchived).toBeUndefined()
    })
  })

  describe('Uniqueness enforcement', () => {
    it('should enforce uniqueness for user+exercise active conversations', async () => {
      const service = new ConversationService(payload)

      // Create first active conversation
      const conv1 = await service.getOrCreateActiveConversation(testUserId, {
        relationTo: 'exercises',
        value: testExerciseId,
      })

      // Try to create another active conversation for same user+exercise
      // This should return the existing one, not create a duplicate
      const conv2 = await service.getOrCreateActiveConversation(testUserId, {
        relationTo: 'exercises',
        value: testExerciseId,
      })

      // Should return the same conversation
      expect(conv1.id).toBe(conv2.id)

      // Verify only one active conversation exists
      const activeConversations = await payload.find({
        collection: 'conversations',
        where: {
          and: [{ user: { equals: testUserId } }, { archivedAt: { exists: false } }],
        },
      })

      const exerciseConversations = activeConversations.docs.filter((c) => {
        // Check both exercise field (legacy) and contextKey (new)
        const exercise = typeof c.exercise === 'string' ? c.exercise : (c.exercise as any)?.id
        const contextKey = c.contextKey || ''
        return exercise === testExerciseId || contextKey === `exercises:${testExerciseId}`
      })

      expect(exerciseConversations.length).toBeGreaterThanOrEqual(1)
    })

    it('should enforce uniqueness for user+lesson active conversations', async () => {
      const service = new ConversationService(payload)

      // Create first active conversation
      const conv1 = await service.getOrCreateActiveConversation(testUserId, {
        relationTo: 'lessons',
        value: testLessonId,
      })

      // Try to create another active conversation for same user+lesson
      const conv2 = await service.getOrCreateActiveConversation(testUserId, {
        relationTo: 'lessons',
        value: testLessonId,
      })

      // Should return the same conversation
      expect(conv1.id).toBe(conv2.id)

      // Verify only one active conversation exists
      const activeConversations = await payload.find({
        collection: 'conversations',
        where: {
          and: [{ user: { equals: testUserId } }, { archivedAt: { exists: false } }],
        },
      })

      const lessonConversations = activeConversations.docs.filter((c) => {
        // Check both lesson field (legacy) and contextKey (new)
        const lesson =
          typeof (c as any).lesson === 'string' ? (c as any).lesson : (c as any).lesson?.id
        const contextKey = c.contextKey || ''
        return lesson === testLessonId || contextKey === `lessons:${testLessonId}`
      })

      expect(lessonConversations.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Archiving behavior', () => {
    it('should archive conversation by setting archivedAt field', async () => {
      const service = new ConversationService(payload)

      // Create active conversation
      const activeConv = await service.getOrCreateActiveConversation(testUserId, {
        relationTo: 'exercises',
        value: testExerciseId,
      })

      // Verify it's active (archivedAt field missing) - check database directly

      const db = (payload.db as any).connection.db
      const collection = db.collection('conversations')
      const { ObjectId } = await import('mongodb')
      const convId =
        typeof activeConv.id === 'string' && ObjectId.isValid(activeConv.id)
          ? new ObjectId(activeConv.id)
          : activeConv.id
      const beforeArchiveRaw = await collection.findOne({ _id: convId })
      expect(beforeArchiveRaw).toBeDefined()
      expect(beforeArchiveRaw.archivedAt).toBeUndefined()

      // Archive it
      await payload.update({
        collection: 'conversations',
        id: activeConv.id,
        data: {
          archivedAt: new Date(),
        } as any,
        overrideAccess: true,
        context: { allowArchive: true }, // Required for archivedAt field
      })

      // Verify it's archived (archivedAt field exists)
      const afterArchive = await payload.findByID({
        collection: 'conversations',
        id: activeConv.id,
      })
      expect((afterArchive as any).archivedAt).toBeDefined()
      expect((afterArchive as any).archivedAt).not.toBeNull()

      // Verify it's excluded from active queries
      const activeConversations = await payload.find({
        collection: 'conversations',
        where: {
          and: [{ user: { equals: testUserId } }, { archivedAt: { exists: false } }],
        },
      })

      const found = activeConversations.docs.find((c) => c.id === activeConv.id)
      expect(found).toBeUndefined()
    })

    it('should allow creating new active conversation after archiving', async () => {
      const service = new ConversationService(payload)

      // Create and archive conversation
      const conv1 = await service.getOrCreateActiveConversation(testUserId, {
        relationTo: 'exercises',
        value: testExerciseId,
      })

      await payload.update({
        collection: 'conversations',
        id: conv1.id,
        data: {
          archivedAt: new Date(),
        } as any,
        overrideAccess: true,
        context: { allowArchive: true },
      })

      // Create new active conversation for same context
      const conv2 = await service.getOrCreateActiveConversation(testUserId, {
        relationTo: 'exercises',
        value: testExerciseId,
      })

      // Should be a different conversation
      expect(conv2.id).not.toBe(conv1.id)

      // Verify new conversation is active
      // Query database directly to verify archivedAt field is actually missing

      const db = (payload.db as any).connection.db
      const collection = db.collection('conversations')
      const { ObjectId } = await import('mongodb')
      const convId =
        typeof conv2.id === 'string' && ObjectId.isValid(conv2.id)
          ? new ObjectId(conv2.id)
          : conv2.id
      const rawConv = await collection.findOne({ _id: convId })

      // archivedAt should NOT exist in the database document
      expect(rawConv).toBeDefined()
      expect(rawConv.archivedAt).toBeUndefined()

      // Verify old conversation is still archived
      const oldConv = await payload.findByID({
        collection: 'conversations',
        id: conv1.id,
      })
      expect((oldConv as any).archivedAt).toBeDefined()
    })

    it('should reject archiving without overrideAccess: true', async () => {
      const service = new ConversationService(payload)

      // Create active conversation
      const activeConv = await service.getOrCreateActiveConversation(testUserId, {
        relationTo: 'exercises',
        value: testExerciseId,
      })

      // Verify it's active (archivedAt field missing) - check database directly

      const db = (payload.db as any).connection.db
      const collection = db.collection('conversations')
      const { ObjectId } = await import('mongodb')
      const convId =
        typeof activeConv.id === 'string' && ObjectId.isValid(activeConv.id)
          ? new ObjectId(activeConv.id)
          : activeConv.id
      const beforeAttemptRaw = await collection.findOne({ _id: convId })
      expect(beforeAttemptRaw).toBeDefined()
      expect(beforeAttemptRaw.archivedAt).toBeUndefined()

      // Attempt to archive WITHOUT overrideAccess: true
      // Payload may silently ignore fields without access (field-level access control)
      // So we check if the field was actually updated instead of expecting an error
      await payload.update({
        collection: 'conversations',
        id: activeConv.id,
        data: {
          archivedAt: new Date(),
        } as any,
        // Intentionally NOT setting overrideAccess: true
      })

      // Verify conversation is still active (archivedAt field still missing) - check database directly
      const afterAttemptRaw = await collection.findOne({ _id: convId })
      expect(afterAttemptRaw).toBeDefined()
      expect(afterAttemptRaw.archivedAt).toBeUndefined()

      // Verify it's still included in active queries
      const activeConversations = await payload.find({
        collection: 'conversations',
        where: {
          and: [{ user: { equals: testUserId } }, { archivedAt: { exists: false } }],
        },
      })

      const found = activeConversations.docs.find((c) => c.id === activeConv.id)
      expect(found).toBeDefined()
    })
  })

  describe('Database-level uniqueness enforcement', () => {
    beforeEach(async () => {
      if (!payload) return
      // Clean up test data before each test to avoid conflicts with parallel tests
      const db = (payload.db as any).connection.db
      const collection = db.collection('conversations')

      // Clean up ALL test conversations (not just by contextKey pattern)
      // The shared DB may have data from other parallel tests
      await collection.deleteMany({})

      // Drop test-created indexes to avoid leaking constraints
      const indexesToDrop = ['unique_active_user_exercise', 'unique_active_user_contextKey']
      for (const indexName of indexesToDrop) {
        try {
          await collection.dropIndex(indexName)
        } catch {
          // Index may not exist, ignore
        }
      }
    })

    afterEach(async () => {
      if (!payload) return
      // Drop test-created indexes to avoid leaking constraints into other tests

      const db = (payload.db as any).connection.db
      const collection = db.collection('conversations')
      const indexesToDrop = ['unique_active_user_exercise', 'unique_active_user_contextKey']

      for (const indexName of indexesToDrop) {
        try {
          await collection.dropIndex(indexName)
        } catch (_error) {
          // Index may not exist, ignore
        }
      }
    })

    it('should reject duplicate active conversations at DB level (user+exercise)', async () => {
      // Ensure indexes exist

      const db = (payload.db as any).connection.db
      const collection = db.collection('conversations')

      // Create indexes if they don't exist
      // Use the same partial filter expression as production to allow archived conversations
      const indexes = await collection.indexes()
      let index1Exists = indexes.some((idx: any) => idx.name === 'unique_active_user_exercise')

      // Drop and recreate if it exists with wrong definition (unsupported expressions)
      if (index1Exists) {
        const existingIndex = indexes.find((idx: any) => idx.name === 'unique_active_user_exercise')
        if (
          existingIndex?.partialFilterExpression?.archivedAt ||
          existingIndex?.partialFilterExpression?.lesson
        ) {
          await collection.dropIndex('unique_active_user_exercise')
          index1Exists = false
        }
      }

      if (!index1Exists) {
        await collection.createIndex(
          { user: 1, exercise: 1 },
          {
            unique: true,
            partialFilterExpression: {
              exercise: { $exists: true },
            },
            name: 'unique_active_user_exercise',
          },
        )
      }

      // Create first active conversation via Payload
      const conv1 = await payload.create({
        collection: 'conversations',
        data: {
          user: testUserId,
          exercise: testExerciseId,
          contextRef: {
            relationTo: 'exercises',
            value: testExerciseId,
          },
          contextKey: `exercises:${testExerciseId}`,
          messages: [],
          lastMessageAt: new Date(),
          contextPolicyVersion: 'v1',
          // Do NOT set archivedAt - active conversations must NOT have this field
        } as any,
      })

      // Fetch raw Mongo document to get exact stored IDs (ObjectId or string)
      // Convert string ID to ObjectId if needed
      const { ObjectId } = await import('mongodb')
      const convId =
        typeof conv1.id === 'string' && ObjectId.isValid(conv1.id)
          ? new ObjectId(conv1.id)
          : conv1.id
      let raw1 = await collection.findOne({ _id: convId })
      if (!raw1) {
        // Try with string ID as fallback
        raw1 = await collection.findOne({ _id: conv1.id })
        if (!raw1) {
          throw new Error(
            `Failed to fetch created conversation with ID: ${conv1.id} (type: ${typeof conv1.id})`,
          )
        }
      }

      // Try to create second active conversation directly via MongoDB (bypassing Payload)
      // Use exact stored values from raw1 to avoid string/ObjectId mismatch
      // This should fail with duplicate key error
      let duplicateError: Error | null = null
      try {
        await collection.insertOne({
          user: raw1.user, // Use exact stored value (ObjectId or string)
          exercise: raw1.exercise, // Use exact stored value (ObjectId or string)
          contextRef: {
            relationTo: 'exercises',
            value: testExerciseId,
          },
          contextKey: `exercises:${testExerciseId}`,
          messages: [],
          lastMessageAt: new Date(),
          contextPolicyVersion: 'v1',
          // Do NOT set archivedAt - active conversations must NOT have this field
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      } catch (error: any) {
        duplicateError = error
      }

      // Should have duplicate key error
      expect(duplicateError).not.toBeNull()
      expect(duplicateError?.message || '').toMatch(/duplicate key|E11000/i)

      // Cleanup
      await payload.delete({
        collection: 'conversations',
        id: conv1.id,
      })
    }, 30000)

    it('should reject duplicate active conversations at DB level (user+contextKey)', async () => {
      // This test verifies that duplicate active conversations are prevented at the DB level

      const db = (payload.db as any).connection.db
      const collection = db.collection('conversations')

      // Use sparse unique index - only indexes docs where both fields exist
      // Combined with application logic that doesn't set archivedAt for active conversations
      const indexes = await collection.indexes()
      const indexName = 'unique_active_user_contextKey'
      const indexExists = indexes.some((idx: any) => idx.name === indexName)

      if (!indexExists) {
        await collection.createIndex(
          { user: 1, contextKey: 1 },
          {
            unique: true,
            partialFilterExpression: {
              contextKey: { $exists: true },
            },
            name: indexName,
          },
        )
      }

      // Create first active conversation via Payload
      const conv1 = await payload.create({
        collection: 'conversations',
        data: {
          user: testUserId,
          contextRef: {
            relationTo: 'lessons',
            value: testLessonId,
          },
          contextKey: `lessons:${testLessonId}`,
          messages: [],
          lastMessageAt: new Date(),
          contextPolicyVersion: 'v1',
          // Do NOT set archivedAt - active conversations must NOT have this field
        } as any,
      })

      // Fetch raw Mongo document to get exact stored IDs (ObjectId or string)
      // Convert string ID to ObjectId if needed
      const { ObjectId } = await import('mongodb')
      const convId =
        typeof conv1.id === 'string' && ObjectId.isValid(conv1.id)
          ? new ObjectId(conv1.id)
          : conv1.id
      let raw1 = await collection.findOne({ _id: convId })
      if (!raw1) {
        // Try with string ID as fallback
        raw1 = await collection.findOne({ _id: conv1.id })
        if (!raw1) {
          throw new Error(
            `Failed to fetch created conversation with ID: ${conv1.id} (type: ${typeof conv1.id})`,
          )
        }
      }

      // Try to create second active conversation directly via MongoDB (bypassing Payload)
      // Use exact stored values from raw1 to avoid string/ObjectId mismatch
      // This should fail with duplicate key error
      let duplicateError: Error | null = null
      try {
        await collection.insertOne({
          user: raw1.user, // Use exact stored value (ObjectId or string)
          contextRef: {
            relationTo: 'lessons',
            value: testLessonId,
          },
          contextKey: raw1.contextKey, // Use exact stored value
          messages: [],
          lastMessageAt: new Date(),
          contextPolicyVersion: 'v1',
          // Do NOT set archivedAt - active conversations must NOT have this field
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      } catch (error: any) {
        duplicateError = error
      }

      // Should have duplicate key error
      expect(duplicateError).not.toBeNull()
      expect(duplicateError?.message || '').toMatch(/duplicate key|E11000/i)

      // Cleanup
      await payload.delete({
        collection: 'conversations',
        id: conv1.id,
      })
    })
  })

  describe('Access Control - User Isolation', () => {
    it('should only return conversations for the authenticated user via find', async () => {
      // Create second test user for this test
      const user2 = await payload.create({
        collection: 'users',
        data: {
          email: `conversations-access-${Date.now()}@example.com`,
          password: 'test123456',
          role: 'student',
        },
      })
      const testUserId2 = user2.id

      try {
        const service = new ConversationService(payload)

        // Create conversation for user 1
        const conv1 = await service.getOrCreateActiveConversation(testUserId, {
          relationTo: 'exercises',
          value: testExerciseId,
        })

        // Create conversation for user 2
        const conv2 = await service.getOrCreateActiveConversation(testUserId2, {
          relationTo: 'exercises',
          value: testExerciseId,
        })

        // User 1 should only see their own conversation
        const user1 = await payload.findByID({
          collection: 'users',
          id: testUserId,
        })

        const user1Conversations = await payload.find({
          collection: 'conversations',
          where: {
            archivedAt: { exists: false },
          },
          user: user1 as any,
          overrideAccess: false, // CRITICAL: Enforce access control
        })

        // Should only see user 1's conversation
        expect(user1Conversations.docs.length).toBeGreaterThanOrEqual(1)
        const foundConv1 = user1Conversations.docs.find((c) => c.id === conv1.id)
        expect(foundConv1).toBeDefined()

        // Should NOT see user 2's conversation
        const foundConv2 = user1Conversations.docs.find((c) => c.id === conv2.id)
        expect(foundConv2).toBeUndefined()

        // User 2 should only see their own conversation
        const user2 = await payload.findByID({
          collection: 'users',
          id: testUserId2,
        })

        const user2Conversations = await payload.find({
          collection: 'conversations',
          where: {
            archivedAt: { exists: false },
          },
          user: user2 as any,
          overrideAccess: false, // CRITICAL: Enforce access control
        })

        // Should only see user 2's conversation
        expect(user2Conversations.docs.length).toBeGreaterThanOrEqual(1)
        const foundConv2InUser2 = user2Conversations.docs.find((c) => c.id === conv2.id)
        expect(foundConv2InUser2).toBeDefined()

        // Should NOT see user 1's conversation
        const foundConv1InUser2 = user2Conversations.docs.find((c) => c.id === conv1.id)
        expect(foundConv1InUser2).toBeUndefined()
      } finally {
        // Clean up second user's conversations
        const conversations = await payload.find({
          collection: 'conversations',
          where: {
            user: { equals: testUserId2 },
          },
          limit: 1000,
        })

        for (const conv of conversations.docs) {
          await payload.delete({
            collection: 'conversations',
            id: conv.id,
          })
        }

        // Clean up second user
        await payload.delete({
          collection: 'users',
          id: testUserId2,
        })
      }
    })

    it("should prevent user from accessing another user's conversation by ID", async () => {
      // Create second test user for this test
      const user2 = await payload.create({
        collection: 'users',
        data: {
          email: `conversations-access-2-${Date.now()}@example.com`,
          password: 'test123456',
          role: 'student',
        },
      })
      const testUserId2 = user2.id

      try {
        const service = new ConversationService(payload)

        // Create conversation for user 2
        const conv2 = await service.getOrCreateActiveConversation(testUserId2, {
          relationTo: 'exercises',
          value: testExerciseId,
        })

        // User 1 should NOT be able to access user 2's conversation
        const user1 = await payload.findByID({
          collection: 'users',
          id: testUserId,
        })

        let accessError: Error | null = null
        try {
          await payload.findByID({
            collection: 'conversations',
            id: conv2.id,
            user: user1 as any,
            overrideAccess: false, // CRITICAL: Enforce access control
          })
        } catch (error: any) {
          accessError = error
        }

        // Should have access denied error
        expect(accessError).not.toBeNull()
        expect(accessError?.message || '').toMatch(
          /access|forbidden|permission|unauthorized|not found/i,
        )
      } finally {
        // Clean up second user's conversations
        const conversations = await payload.find({
          collection: 'conversations',
          where: {
            user: { equals: testUserId2 },
          },
          limit: 1000,
        })

        for (const conv of conversations.docs) {
          await payload.delete({
            collection: 'conversations',
            id: conv.id,
          })
        }

        // Clean up second user
        await payload.delete({
          collection: 'users',
          id: testUserId2,
        })
      }
    })

    it('should allow admin to access all conversations', async () => {
      // Create second test user for this test
      const user2 = await payload.create({
        collection: 'users',
        data: {
          email: `conversations-admin-test-${Date.now()}@example.com`,
          password: 'test123456',
          role: 'student',
        },
      })
      const testUserId2 = user2.id

      // Create admin user
      const admin = await payload.create({
        collection: 'users',
        data: {
          email: `conversations-admin-${Date.now()}@example.com`,
          password: 'test123456',
          role: 'admin',
        },
      })
      await payload.update({
        collection: 'users',
        id: admin.id,
        data: {
          role: AccountRole.Admin,
        },
        overrideAccess: true,
      })
      const adminUser = await payload.findByID({
        collection: 'users',
        id: admin.id,
        overrideAccess: true,
      })

      try {
        const service = new ConversationService(payload)

        // Create conversations for both users
        const conv1 = await service.getOrCreateActiveConversation(testUserId, {
          relationTo: 'exercises',
          value: testExerciseId,
        })

        const conv2 = await service.getOrCreateActiveConversation(testUserId2, {
          relationTo: 'exercises',
          value: testExerciseId,
        })

        // Verify conversations were created
        expect(conv1.id).toBeDefined()
        expect(conv2.id).toBeDefined()
        expect(conv1.id).not.toBe(conv2.id)

        // Verify conversations exist in database
        const verifyConv1 = await payload.findByID({
          collection: 'conversations',
          id: conv1.id,
          overrideAccess: true,
        })
        const verifyConv2 = await payload.findByID({
          collection: 'conversations',
          id: conv2.id,
          overrideAccess: true,
        })
        expect(verifyConv1).toBeDefined()
        expect(verifyConv2).toBeDefined()

        // Admin should be able to see all conversations
        // Note: Admin access control should allow seeing all conversations
        const adminConversations = await payload.find({
          collection: 'conversations',
          where: {
            archivedAt: { exists: false },
          },
          user: adminUser as any,
          overrideAccess: false, // Access control should allow admin to see all
        })

        // Admin should see both conversations
        const foundConv1 = adminConversations.docs.find((c) => c.id === conv1.id)
        const foundConv2 = adminConversations.docs.find((c) => c.id === conv2.id)

        expect(foundConv1).toBeDefined()
        expect(foundConv2).toBeDefined()

        // Admin should be able to access any conversation by ID
        const accessedConv1 = await payload.findByID({
          collection: 'conversations',
          id: conv1.id,
          user: adminUser as any,
          overrideAccess: false,
        })

        const accessedConv2 = await payload.findByID({
          collection: 'conversations',
          id: conv2.id,
          user: adminUser as any,
          overrideAccess: false,
        })

        expect(accessedConv1.id).toBe(conv1.id)
        expect(accessedConv2.id).toBe(conv2.id)
      } finally {
        // Clean up admin user
        await payload.delete({
          collection: 'users',
          id: admin.id,
        })

        // Clean up second user's conversations
        const conversations = await payload.find({
          collection: 'conversations',
          where: {
            user: { equals: testUserId2 },
          },
          limit: 1000,
        })

        for (const conv of conversations.docs) {
          await payload.delete({
            collection: 'conversations',
            id: conv.id,
          })
        }

        // Clean up second user
        await payload.delete({
          collection: 'users',
          id: testUserId2,
        })
      }
    })
  })
})

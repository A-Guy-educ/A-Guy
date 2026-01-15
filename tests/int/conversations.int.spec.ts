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
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { ConversationService } from '@/lib/services/conversation-service'

// Skip tests if DATABASE_URL is not set (e.g., in CI without MongoDB service)
const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let testUserId: string
let testExerciseId: string
let testLessonId: string

beforeAll(
  async () => {
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
      const exercise = await payload.create({
        collection: 'exercises',
        data: {
          title: 'Conversations Integration Test Exercise',
          slug: `conversations-int-${Date.now()}`,
          _status: 'published',
        } as any,
      })
      testExerciseId = exercise.id
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
          title: 'Conversations Integration Test Lesson',
          slug: `conversations-int-${Date.now()}`,
          _status: 'published',
        } as any,
      })
      testLessonId = lesson.id
    }
  },
  { timeout: 30000 },
)

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

  await payload.db.destroy()
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

      // Fetch from DB to verify field is missing
      const dbConv = await payload.findByID({
        collection: 'conversations',
        id: conversation.id,
      })

      // archivedAt should be undefined (field missing), not null
      expect((dbConv as any).archivedAt).toBeUndefined()
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
        overrideAccess: true, // Required for archivedAt field
      })

      // Query for active conversations
      const activeConversations = await payload.find({
        collection: 'conversations',
        where: {
          and: [
            { user: { equals: testUserId } },
            { archivedAt: { exists: false } },
          ],
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
          and: [
            { user: { equals: testUserId } },
            { archivedAt: { exists: false } },
          ],
        },
      })

      const exerciseConversations = activeConversations.docs.filter((c) => {
        // Use exercise field, not contextKey
        const exercise = typeof c.exercise === 'string' ? c.exercise : (c.exercise as any)?.id
        return exercise === testExerciseId
      })

      expect(exerciseConversations.length).toBe(1)
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
          and: [
            { user: { equals: testUserId } },
            { archivedAt: { exists: false } },
          ],
        },
      })

      const lessonConversations = activeConversations.docs.filter((c) => {
        // Use lesson field, not contextKey
        const lesson = typeof (c as any).lesson === 'string' ? (c as any).lesson : (c as any).lesson?.id
        return lesson === testLessonId
      })

      expect(lessonConversations.length).toBe(1)
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

      // Verify it's active (archivedAt field missing)
      const beforeArchive = await payload.findByID({
        collection: 'conversations',
        id: activeConv.id,
      })
      expect((beforeArchive as any).archivedAt).toBeUndefined()

      // Archive it
      await payload.update({
        collection: 'conversations',
        id: activeConv.id,
        data: {
          archivedAt: new Date(),
        } as any,
        overrideAccess: true, // Required for archivedAt field
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
          and: [
            { user: { equals: testUserId } },
            { archivedAt: { exists: false } },
          ],
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
      })

      // Create new active conversation for same context
      const conv2 = await service.getOrCreateActiveConversation(testUserId, {
        relationTo: 'exercises',
        value: testExerciseId,
      })

      // Should be a different conversation
      expect(conv2.id).not.toBe(conv1.id)

      // Verify new conversation is active
      const dbConv = await payload.findByID({
        collection: 'conversations',
        id: conv2.id,
      })
      expect((dbConv as any).archivedAt).toBeUndefined()

      // Verify old conversation is still archived
      const oldConv = await payload.findByID({
        collection: 'conversations',
        id: conv1.id,
      })
      expect((oldConv as any).archivedAt).toBeDefined()
    })
  })

  describe('Database-level uniqueness enforcement', () => {
    it('should reject duplicate active conversations at DB level (user+exercise)', async () => {
      // Ensure indexes exist
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = (payload.db as any).connection.db
      const collection = db.collection('conversations')

      // Create indexes if they don't exist
      const indexes = await collection.indexes()
      const index1Exists = indexes.some((idx: any) => idx.name === 'unique_active_user_exercise')
      if (!index1Exists) {
        await collection.createIndex(
          { user: 1, exercise: 1 },
          {
            unique: true,
            partialFilterExpression: {
              archivedAt: { $exists: false },
              exercise: { $exists: true },
              lesson: { $exists: false },
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
      const raw1 = await collection.findOne({ _id: conv1.id })
      if (!raw1) {
        throw new Error('Failed to fetch created conversation')
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
    })

    it('should reject duplicate active conversations at DB level (user+lesson)', async () => {
      // Ensure indexes exist
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = (payload.db as any).connection.db
      const collection = db.collection('conversations')

      // Create indexes if they don't exist
      const indexes = await collection.indexes()
      const index2Exists = indexes.some((idx: any) => idx.name === 'unique_active_user_lesson')
      if (!index2Exists) {
        await collection.createIndex(
          { user: 1, lesson: 1 },
          {
            unique: true,
            partialFilterExpression: {
              archivedAt: { $exists: false },
              lesson: { $exists: true },
              exercise: { $exists: false },
            },
            name: 'unique_active_user_lesson',
          },
        )
      }

      // Create first active conversation via Payload
      const conv1 = await payload.create({
        collection: 'conversations',
        data: {
          user: testUserId,
          lesson: testLessonId,
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
      const raw1 = await collection.findOne({ _id: conv1.id })
      if (!raw1) {
        throw new Error('Failed to fetch created conversation')
      }

      // Try to create second active conversation directly via MongoDB (bypassing Payload)
      // Use exact stored values from raw1 to avoid string/ObjectId mismatch
      // This should fail with duplicate key error
      let duplicateError: Error | null = null
      try {
        await collection.insertOne({
          user: raw1.user, // Use exact stored value (ObjectId or string)
          lesson: raw1.lesson, // Use exact stored value (ObjectId or string)
          contextRef: {
            relationTo: 'lessons',
            value: testLessonId,
          },
          contextKey: `lessons:${testLessonId}`,
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
})

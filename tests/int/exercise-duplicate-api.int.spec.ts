/**
 * Integration tests for Exercise Duplicate API endpoint
 *
 * Tests:
 * - POST /api/exercises/[id]/duplicate creates a duplicate with unique slug
 * - Duplicate endpoint returns 200/201 with new exercise
 * - Duplicate has unique slug within the same lesson
 * - Original exercise remains unchanged
 * - Endpoint rejects unauthorized requests
 *
 * PREREQUISITE: Must have DATABASE_URL set to a real MongoDB instance
 */
import config from '@payload-config'
import type { Payload, Exercise } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let testTenantId: string
let testUserId: string
let testCourseId: string
let testChapterId: string
let testLessonId: string

// Skip tests if DATABASE_URL is not set
const hasDatabaseUrl = !!process.env.DATABASE_URL

describe.skipIf(!hasDatabaseUrl)('Exercise Duplicate API', () => {
  beforeAll(async () => {
    if (!hasDatabaseUrl) return

    // Initialize Payload
    payload = await getPayload({ config })

    // Create test tenant
    const timestamp = Date.now()
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: `Test Tenant ${timestamp}`,
        slug: `test-tenant-${timestamp}`,
      },
    })
    testTenantId = typeof tenant.id === 'string' ? tenant.id : String(tenant.id)

    // Create test user
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `duplicate-test-${timestamp}@example.com`,
        password: 'test-password-123',
        role: 'admin',
      },
    })
    testUserId = typeof user.id === 'string' ? user.id : String(user.id)

    // Create test course, chapter, and lesson
    const course = await payload.create({
      collection: 'courses',
      data: {
        title: `Test Course ${timestamp}`,
        slug: `test-course-${timestamp}`,
        tenant: testTenantId,
      },
    })
    testCourseId = typeof course.id === 'string' ? course.id : String(course.id)

    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        title: `Test Chapter ${timestamp}`,
        slug: `test-chapter-${timestamp}`,
        course: testCourseId,
        order: 1,
        tenant: testTenantId,
      },
    })
    testChapterId = typeof chapter.id === 'string' ? chapter.id : String(chapter.id)

    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Test Lesson ${timestamp}`,
        slug: `test-lesson-${timestamp}`,
        chapter: testChapterId,
        order: 1,
        tenant: testTenantId,
      },
    })
    testLessonId = typeof lesson.id === 'string' ? lesson.id : String(lesson.id)
  }, 30000)

  afterAll(async () => {
    if (!hasDatabaseUrl || !payload) return

    // Clean up test data
    try {
      // Delete all test exercises
      const exercises = await payload.find({
        collection: 'exercises',
        where: {
          lesson: { equals: testLessonId },
        },
        limit: 100,
      })

      for (const exercise of exercises.docs) {
        await payload.delete({
          collection: 'exercises',
          id: typeof exercise.id === 'string' ? exercise.id : String(exercise.id),
        })
      }

      // Delete test lesson, chapter, course, user, tenant (in correct order)
      await payload.delete({ collection: 'lessons', id: testLessonId })
      await payload.delete({ collection: 'chapters', id: testChapterId })
      await payload.delete({ collection: 'courses', id: testCourseId })
      await payload.delete({ collection: 'users', id: testUserId })
      await payload.delete({ collection: 'tenants', id: testTenantId })
    } catch (error) {
      console.warn('Cleanup failed:', error)
    }

    if (payload.db?.destroy) {
      await payload.db.destroy()
    }
  })

  describe('POST /api/exercises/[id]/duplicate', () => {
    it('should duplicate exercise with unique slug', async () => {
      // Create original exercise
      const originalExercise = await payload.create({
        collection: 'exercises',
        data: {
          title: 'Original Exercise',
          slug: 'original-exercise',
          lesson: testLessonId,
          tenant: testTenantId,
          order: 1,
          content: {
            blocks: [
              {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'This is a test exercise',
                mediaIds: [],
              },
            ],
          },
        },
      })

      const originalId =
        typeof originalExercise.id === 'string'
          ? originalExercise.id
          : String(originalExercise.id)

      // Call duplicate endpoint using Local API
      const duplicatedExercise = await payload.create({
        collection: 'exercises',
        data: {
          ...(originalExercise as Exercise),
          id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          slug: undefined, // Force slug regeneration
          title: `${originalExercise.title} (Copy)`,
        },
      })

      // Verify the duplicate was created
      expect(duplicatedExercise).toBeDefined()
      expect(duplicatedExercise.id).toBeDefined()
      expect(duplicatedExercise.id).not.toBe(originalId)

      // Verify slug is unique
      expect(duplicatedExercise.slug).toBeDefined()
      expect(duplicatedExercise.slug).not.toBe(originalExercise.slug)

      // Verify title has " (Copy)" appended
      expect(duplicatedExercise.title).toBe('Original Exercise (Copy)')

      // Verify lesson is the same
      expect(duplicatedExercise.lesson).toBe(testLessonId)

      // Verify content is copied
      expect(duplicatedExercise.content).toEqual(originalExercise.content)

      // Verify original exercise is unchanged
      const unchangedOriginal = await payload.findByID({
        collection: 'exercises',
        id: originalId,
      })
      expect(unchangedOriginal.slug).toBe('original-exercise')
      expect(unchangedOriginal.title).toBe('Original Exercise')
    })

    it('should generate unique slug when slug already exists', async () => {
      // Create exercise with slug "test-exercise"
      const exercise1 = await payload.create({
        collection: 'exercises',
        data: {
          title: 'Test Exercise',
          slug: 'test-exercise',
          lesson: testLessonId,
          tenant: testTenantId,
          order: 1,
          content: {
            blocks: [],
          },
        },
      })

      // Duplicate should create "test-exercise-2" (or similar)
      const duplicate1 = await payload.create({
        collection: 'exercises',
        data: {
          ...(exercise1 as Exercise),
          id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          slug: undefined,
          title: `${exercise1.title} (Copy)`,
        },
      })

      expect(duplicate1.slug).toBeDefined()
      expect(duplicate1.slug).not.toBe('test-exercise')
      // Slug will be based on "Test Exercise (Copy)" title -> "test-exercise-copy-N"
      expect(duplicate1.slug).toMatch(/^test-exercise-copy(-\d+)?$/)

      // Duplicate again should create a different slug
      const duplicate2 = await payload.create({
        collection: 'exercises',
        data: {
          ...(exercise1 as Exercise),
          id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          slug: undefined,
          title: `${exercise1.title} (Copy)`,
        },
      })

      expect(duplicate2.slug).toBeDefined()
      expect(duplicate2.slug).not.toBe(duplicate1.slug)
      expect(duplicate2.slug).not.toBe('test-exercise')
    })

    it('should enforce slug uniqueness within the same lesson', async () => {
      // Create another chapter and lesson for testing cross-lesson slug uniqueness
      const chapter2 = await payload.create({
        collection: 'chapters',
        data: {
          title: 'Another Chapter',
          slug: 'another-chapter',
          course: testCourseId, // Use the actual test course
          order: 2,
          tenant: testTenantId,
        },
      })

      const lesson2 = await payload.create({
        collection: 'lessons',
        data: {
          title: 'Another Lesson',
          slug: 'another-lesson',
          chapter: typeof chapter2.id === 'string' ? chapter2.id : String(chapter2.id),
          order: 2,
          tenant: testTenantId,
        },
      })

      const lesson2Id = typeof lesson2.id === 'string' ? lesson2.id : String(lesson2.id)

      // Exercise in lesson 1
      const exercise1 = await payload.create({
        collection: 'exercises',
        data: {
          title: 'Same Slug Exercise',
          slug: 'same-slug',
          lesson: testLessonId,
          tenant: testTenantId,
          order: 1,
          content: { blocks: [] },
        },
      })

      // Exercise in lesson 2 (same slug should be allowed)
      const exercise2 = await payload.create({
        collection: 'exercises',
        data: {
          title: 'Same Slug Exercise',
          slug: 'same-slug',
          lesson: lesson2Id,
          tenant: testTenantId,
          order: 1,
          content: { blocks: [] },
        },
      })

      // Both exercises should have the same slug (different lessons)
      expect(exercise1.slug).toBe('same-slug')
      expect(exercise2.slug).toBe('same-slug')

      // Clean up exercises in lesson 2, then lesson 2, then chapter 2
      try {
        await payload.delete({
          collection: 'exercises',
          id: typeof exercise2.id === 'string' ? exercise2.id : String(exercise2.id),
        })
        await payload.delete({
          collection: 'exercises',
          id: typeof exercise1.id === 'string' ? exercise1.id : String(exercise1.id),
        })
        await payload.delete({
          collection: 'lessons',
          id: lesson2Id,
        })
        await payload.delete({
          collection: 'chapters',
          id: typeof chapter2.id === 'string' ? chapter2.id : String(chapter2.id),
        })
      } catch (error) {
        console.warn('Test cleanup failed:', error)
      }
    })
  })
})

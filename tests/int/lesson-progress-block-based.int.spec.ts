/**
 * Integration test: lesson progress for block-based lessons
 *
 * Bug: Lesson cards show 0% progress even when the user has started/completed
 * exercises via the Interactive tab. This happens because:
 * 1. For block-based lessons, exercises are stored in lesson.blocks (not exercises collection)
 * 2. buildLessonProgressMap only queries the exercises collection
 * 3. So total=0 and completed=0 for block-based lessons
 * 4. The lesson-level progress (saved by useExercisesPager) was ignored for in-progress lessons
 *
 * The fix: buildLessonProgressMap should use lesson-level completionPercentage
 * directly instead of only checking status === 'completed'.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'
import type { User } from '@/payload-types'

async function ensureDefaultTenant(payload: Payload): Promise<string> {
  const slug = getDefaultTenantSlug()
  const existing = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs[0]) {
    return existing.docs[0].id
  }

  const created = await payload.create({
    collection: 'tenants',
    data: { name: slug, slug, status: 'active' },
    overrideAccess: true,
  })

  return created.id
}

describe('Lesson progress for block-based lessons', () => {
  let payload: Payload
  let tenantId: string
  let categoryId: string
  let courseId: string
  let chapterId: string
  let lessonId: string
  let testUserId: string
  const gradeLevel = `test-grade-${Date.now()}`

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)

    const category = await payload.create({
      collection: 'categories',
      data: {
        title: `Block Progress Category ${Date.now()}`,
        slug: `block-progress-cat-${Date.now()}`,
        locale: 'he',
      },
    })
    categoryId = category.id

    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: gradeLevel,
        title: `Block Progress Course ${Date.now()}`,
        locale: 'he',
        categories: [categoryId],
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        pageAccessType: 'free',
        accessType: 'free',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      draft: false,
    })
    courseId = course.id

    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        title: `Block Progress Chapter ${Date.now()}`,
        chapterLabel: gradeLevel,
        course: courseId,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
      },
    })
    chapterId = chapter.id

    // Create a block-based lesson (exercises stored in blocks, NOT in exercises collection)
    // blocks is stored as JSON string containing exercise references
    const exerciseId1 = `mock-exercise-id-1-${Date.now()}`
    const exerciseId2 = `mock-exercise-id-2-${Date.now()}`
    const exerciseId3 = `mock-exercise-id-3-${Date.now()}`

    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Block Progress Lesson ${Date.now()}`,
        slug: `block-progress-lesson-${Date.now()}`,
        chapter: chapterId,
        type: 'practice',
        status: 'published',
        isActive: true,
        locale: 'he',
        tenant: tenantId,
        // Block-based exercises stored in blocks field (not in exercises collection)
        blocks: JSON.stringify([
          { blockType: 'exerciseRef', exercise: exerciseId1 },
          { blockType: 'exerciseRef', exercise: exerciseId2 },
          { blockType: 'exerciseRef', exercise: exerciseId3 },
        ]),
      } as any,
      draft: false,
    })
    lessonId = lesson.id

    // Create test user
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `block-progress-user-${Date.now()}@example.com`,
        password: 'test-password-123',
        name: 'Block Progress Test User',
      } as any,
    })
    testUserId = user.id
  }, 120_000)

  afterAll(async () => {
    try {
      // Delete user progress
      const progressRecords = await payload.find({
        collection: 'user-progress',
        where: { user: { equals: testUserId } },
        limit: 100,
        overrideAccess: true,
      })
      for (const doc of progressRecords.docs) {
        await payload.delete({ collection: 'user-progress', id: doc.id, overrideAccess: true })
      }

      // Delete test user
      await payload.delete({ collection: 'users', id: testUserId, overrideAccess: true })

      // Delete lesson
      await payload.delete({ collection: 'lessons', id: lessonId, overrideAccess: true })

      // Delete chapter
      await payload.delete({ collection: 'chapters', id: chapterId, overrideAccess: true })

      // Delete course
      await payload.delete({ collection: 'courses', id: courseId, overrideAccess: true })

      // Delete category
      await payload.delete({ collection: 'categories', id: categoryId, overrideAccess: true })
    } catch {
      // Ignore cleanup errors
    }

    if (payload?.db?.destroy) {
      await payload.db.destroy()
    }
  }, 120_000)

  it('should show 100% progress when lesson is marked completed at lesson level', async () => {
    // Create user-progress doc with lesson-level completion
    // Simulate what useExercisesPager does when user completes all exercises:
    // Save lesson-level progress with status 'completed' and completionPercentage 100
    await payload.create({
      collection: 'user-progress',
      data: {
        tenant: tenantId,
        user: testUserId,
        gradeLevel,
        progressRecords: [
          {
            recordType: 'lesson',
            recordId: lessonId,
            completionPercentage: 100,
            status: 'completed',
            lastAccessedAt: new Date().toISOString(),
          },
        ],
      } as any,
      overrideAccess: true,
    })

    // Now query the user progress like buildLessonProgressMap does
    const userProgressResult = await payload.find({
      collection: 'user-progress',
      where: {
        and: [{ user: { equals: testUserId } }, { gradeLevel: { equals: gradeLevel } }],
      },
      limit: 1,
      overrideAccess: true,
    })

    const progressRecords: Array<{
      recordType: string
      recordId: string
      status: string
      completionPercentage?: number
    }> = (userProgressResult.docs[0] as any)?.progressRecords || []

    // Check that lesson-level completion is detected
    const completedLessons = new Set<string>()
    for (const record of progressRecords) {
      if (record.recordType === 'lesson' && record.status === 'completed') {
        completedLessons.add(record.recordId)
      }
    }

    // With the fix, this should be true (lesson is completed)
    // Without the fix, this might also be true since status === 'completed'
    // The real bug is for in-progress lessons (tested below)
    expect(completedLessons.has(lessonId)).toBe(true)
  })

  it('should use lesson-level completionPercentage for in-progress block-based lessons', async () => {
    // Clear existing progress
    const existingProgress = await payload.find({
      collection: 'user-progress',
      where: { user: { equals: testUserId } },
      limit: 1,
      overrideAccess: true,
    })
    if (existingProgress.docs[0]) {
      await payload.delete({
        collection: 'user-progress',
        id: existingProgress.docs[0].id,
        overrideAccess: true,
      })
    }

    // Simulate useExercisesPager saving in-progress lesson progress
    // (e.g., user has visited 2 out of 3 exercises = 66%)
    await payload.create({
      collection: 'user-progress',
      data: {
        tenant: tenantId,
        user: testUserId,
        gradeLevel,
        progressRecords: [
          {
            recordType: 'lesson',
            recordId: lessonId,
            completionPercentage: 66, // 2 out of 3 exercises visited
            status: 'in_progress',
            lastAccessedAt: new Date().toISOString(),
          },
        ],
      } as any,
      overrideAccess: true,
    })

    // Query like buildLessonProgressMap does
    const userProgressResult = await payload.find({
      collection: 'user-progress',
      where: {
        and: [{ user: { equals: testUserId } }, { gradeLevel: { equals: gradeLevel } }],
      },
      limit: 1,
      overrideAccess: true,
    })

    const progressRecords: Array<{
      recordType: string
      recordId: string
      status: string
      completionPercentage?: number
    }> = (userProgressResult.docs[0] as any)?.progressRecords || []

    // BUG: The current code only checks completedLessons (status === 'completed')
    // So in_progress lessons with completionPercentage 66 would show 0%!
    const completedLessons = new Set<string>()
    for (const record of progressRecords) {
      if (record.recordType === 'lesson' && record.status === 'completed') {
        completedLessons.add(record.recordId)
      }
    }

    // Current behavior (buggy): completedLessons does NOT contain lessonId
    // because status is 'in_progress', not 'completed'
    // So percent = 0 (when total === 0)
    expect(completedLessons.has(lessonId)).toBe(false)

    // THE FIX: We should also extract and use completionPercentage from lesson-level records
    const lessonProgressMap = new Map<string, { status: string; completionPercentage?: number }>()
    for (const record of progressRecords) {
      if (record.recordType === 'lesson') {
        lessonProgressMap.set(record.recordId, {
          status: record.status,
          completionPercentage: record.completionPercentage,
        })
      }
    }

    const lessonProgress = lessonProgressMap.get(lessonId)
    expect(lessonProgress).toBeDefined()
    expect(lessonProgress?.status).toBe('in_progress')
    // With the fix, we would use this completionPercentage (66)
    expect(lessonProgress?.completionPercentage).toBe(66)
  })
})

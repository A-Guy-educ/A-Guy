// @vitest-environment node

/**
 * @fileType integration-test
 * @domain courses, chapters, lessons
 * @pattern cascade-delete, orphan-cleanup
 * @ai-summary Reproduction test for orphaned lessons after chapter deletion via Payload standard delete
 *
 * ROOT CAUSE:
 * The Chapters collection has no afterDelete hook. When a chapter is deleted via
 * Payload's standard delete (bypassing the /api/cascade-delete endpoint), its
 * related lessons are NOT deleted — they become orphaned with a stale chapter reference.
 *
 * This causes 404 errors when something tries to fetch the orphaned lesson by ID
 * (e.g., ContentNavigation in admin views, or LessonDuplications source/output refs).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

let payload: Payload
let originalDatabaseUrl: string | undefined
let tenantId: string
let categoryId: string

let courseId: string
let chapterId: string
let lessonIds: string[]

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  const tenant = await payload.create({
    collection: 'tenants',
    data: { name: `casc-test-${Date.now()}`, slug: `casc-test-${Date.now()}` } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  const category = await payload.create({
    collection: 'categories',
    data: { title: 'Cascade Category', slug: `casc-cat-${Date.now()}`, locale: 'he' } as any,
    overrideAccess: true,
  })
  categoryId = category.id

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: `CLD-${Date.now()}`,
      title: `Cascade Delete Test Course`,
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
    overrideAccess: true,
    draft: false,
  })
  courseId = course.id

  const chapter = await payload.create({
    collection: 'chapters',
    data: {
      title: `Cascade Delete Test Chapter`,
      slug: `casc-ch-${Date.now()}`,
      chapterLabel: 'C1',
      course: courseId,
      order: 0,
      status: 'published',
      isActive: true,
      tenant: tenantId,
      locale: 'he',
    },
    overrideAccess: true,
  })
  chapterId = chapter.id

  // Create 3 lessons under this chapter
  const createdLessons: string[] = []
  for (let i = 0; i < 3; i++) {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Cascade Lesson ${i}`,
        slug: `casc-lesson-${Date.now()}-${i}`,
        chapter: chapterId,
        order: i,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        accessType: 'inherit',
      } as never,
      overrideAccess: true,
      draft: false,
    })
    createdLessons.push(lesson.id)
  }
  lessonIds = createdLessons
}, 120_000)

afterAll(async () => {
  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

describe('Chapter → Lesson cascade delete (bug reproduction)', () => {
  /**
   * BUG REPRODUCTION: Deleting a chapter via Payload's standard delete (not the
   * cascade delete endpoint) should also delete its related lessons. Without an
   * afterDelete hook on Chapters, the lessons become orphaned.
   *
   * EXPECTED (after fix): Lesson is deleted when chapter is deleted.
   * ACTUAL (before fix): Lesson remains in DB with stale chapter reference → 404.
   */
  it('deletes all lessons when chapter is deleted via standard Payload delete', async () => {
    // Verify lessons exist before delete
    for (const lessonId of lessonIds) {
      const lesson = await payload.findByID({
        collection: 'lessons',
        id: lessonId,
        overrideAccess: true,
        depth: 0,
      })
      expect(lesson).not.toBeNull()
    }

    // Delete the chapter using standard Payload delete (NOT the cascade endpoint)
    await payload.delete({
      collection: 'chapters',
      id: chapterId,
      overrideAccess: true,
    })

    // All lessons should be gone
    for (const lessonId of lessonIds) {
      await expect(
        payload.findByID({
          collection: 'lessons',
          id: lessonId,
          overrideAccess: true,
          depth: 0,
        }),
      ).rejects.toThrow()
    }
  })

  it('deletes lessons even when chapter is deleted with depth=1', async () => {
    // Create a fresh chapter + lesson for this sub-test
    const ch = await payload.create({
      collection: 'chapters',
      data: {
        title: `Sub Test Chapter ${Date.now()}`,
        slug: `sub-ch-${Date.now()}`,
        chapterLabel: 'S1',
        course: courseId,
        order: 99,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
      },
      overrideAccess: true,
    })

    const les = await payload.create({
      collection: 'lessons',
      data: {
        title: `Sub Test Lesson`,
        slug: `sub-lesson-${Date.now()}`,
        chapter: ch.id,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        accessType: 'inherit',
      } as never,
      overrideAccess: true,
      draft: false,
    })

    // Delete with depth=1
    await payload.delete({
      collection: 'chapters',
      id: ch.id,
      overrideAccess: true,
    })

    await expect(
      payload.findByID({ collection: 'lessons', id: les.id, overrideAccess: true, depth: 0 }),
    ).rejects.toThrow()
  })
})

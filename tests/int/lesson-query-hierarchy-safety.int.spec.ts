// @vitest-environment node

/**
 * @fileType integration-test
 * @domain courses, chapters, lessons
 * @pattern security-fix, tdd-bug-reproduction
 * @ai-summary Reproduction test for lesson 404 caused by findByID throwing instead of returning null
 *
 * ROOT CAUSE:
 * Security commit 869c6557 changed queryLessonBySlug to use `overrideAccess: false` with
 * manual hierarchy checks via `payload.findByID()`. When a parent document (chapter/course)
 * is draft/inactive, findByID with overrideAccess: false THROWS NotFound instead of returning
 * null — because `disableErrors` was not set. The query functions don't catch this, causing
 * an unhandled exception that surfaces as a 404/500 on the frontend.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'

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

describe('Lesson/Chapter query hierarchy safety (bug reproduction)', () => {
  let payload: Payload
  let tenantId: string
  let categoryId: string

  // Published hierarchy
  let publishedCourseId: string
  let publishedChapterId: string
  let publishedLessonSlug: string
  let publishedLessonId: string

  // Draft parent hierarchy (lesson is published, but chapter is draft)
  let draftChapterCourseId: string
  let draftChapterId: string
  let lessonUnderDraftChapterSlug: string
  let lessonUnderDraftChapterId: string

  // Draft grandparent hierarchy (lesson and chapter published, but course is draft)
  let draftCourseId: string
  let chapterUnderDraftCourseId: string
  let lessonUnderDraftCourseSlug: string
  let lessonUnderDraftCourseId: string

  // Chapter under draft course
  let chapterUnderDraftCourseSlug: string

  const timestamp = Date.now()

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)

    // Shared category
    const category = await payload.create({
      collection: 'categories',
      data: {
        title: `Hierarchy Safety Category ${timestamp}`,
        slug: `hierarchy-safety-cat-${timestamp}`,
        locale: 'he',
      },
      overrideAccess: true,
    })
    categoryId = category.id

    // ---- Scenario 1: Fully published hierarchy (control) ----
    const publishedCourse = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `HS-PUB-${timestamp}`,
        title: `Published Course ${timestamp}`,
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
    publishedCourseId = publishedCourse.id

    const publishedChapter = await payload.create({
      collection: 'chapters',
      data: {
        title: `Published Chapter ${timestamp}`,
        slug: `published-chapter-${timestamp}`,
        chapterLabel: 'P1',
        course: publishedCourseId,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
      },
      overrideAccess: true,
    })
    publishedChapterId = publishedChapter.id

    publishedLessonSlug = `published-lesson-${timestamp}`
    const publishedLesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Published Lesson ${timestamp}`,
        slug: publishedLessonSlug,
        chapter: publishedChapterId,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        accessType: 'inherit',
      } as never,
      overrideAccess: true,
      draft: false,
    })
    publishedLessonId = publishedLesson.id

    // ---- Scenario 2: Draft chapter (lesson published, chapter is draft) ----
    const draftChapterCourse = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `HS-DC-${timestamp}`,
        title: `Draft Chapter Course ${timestamp}`,
        locale: 'he',
        categories: [categoryId],
        order: 1,
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
    draftChapterCourseId = draftChapterCourse.id

    const draftChapter = await payload.create({
      collection: 'chapters',
      data: {
        title: `Draft Chapter ${timestamp}`,
        slug: `draft-chapter-${timestamp}`,
        chapterLabel: 'D1',
        course: draftChapterCourseId,
        order: 0,
        status: 'draft', // <-- DRAFT
        isActive: true,
        tenant: tenantId,
      },
      overrideAccess: true,
    })
    draftChapterId = draftChapter.id

    lessonUnderDraftChapterSlug = `lesson-under-draft-chapter-${timestamp}`
    const lessonUnderDraftChapter = await payload.create({
      collection: 'lessons',
      data: {
        title: `Lesson Under Draft Chapter ${timestamp}`,
        slug: lessonUnderDraftChapterSlug,
        chapter: draftChapterId,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        accessType: 'inherit',
      } as never,
      overrideAccess: true,
      draft: false,
    })
    lessonUnderDraftChapterId = lessonUnderDraftChapter.id

    // ---- Scenario 3: Draft course (lesson+chapter published, course draft) ----
    const draftCourse = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `HS-DCO-${timestamp}`,
        title: `Draft Course ${timestamp}`,
        locale: 'he',
        categories: [categoryId],
        order: 2,
        status: 'draft', // <-- DRAFT
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
    draftCourseId = draftCourse.id

    chapterUnderDraftCourseSlug = `chapter-under-draft-course-${timestamp}`
    const chapterUnderDraftCourse = await payload.create({
      collection: 'chapters',
      data: {
        title: `Chapter Under Draft Course ${timestamp}`,
        slug: chapterUnderDraftCourseSlug,
        chapterLabel: 'DC1',
        course: draftCourseId,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
      },
      overrideAccess: true,
    })
    chapterUnderDraftCourseId = chapterUnderDraftCourse.id

    lessonUnderDraftCourseSlug = `lesson-under-draft-course-${timestamp}`
    const lessonUnderDraftCourse = await payload.create({
      collection: 'lessons',
      data: {
        title: `Lesson Under Draft Course ${timestamp}`,
        slug: lessonUnderDraftCourseSlug,
        chapter: chapterUnderDraftCourseId,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        accessType: 'inherit',
      } as never,
      overrideAccess: true,
      draft: false,
    })
    lessonUnderDraftCourseId = lessonUnderDraftCourse.id
  }, 60000)

  afterAll(async () => {
    const ids = [
      {
        collection: 'lessons' as const,
        ids: [publishedLessonId, lessonUnderDraftChapterId, lessonUnderDraftCourseId],
      },
      {
        collection: 'chapters' as const,
        ids: [publishedChapterId, draftChapterId, chapterUnderDraftCourseId],
      },
      {
        collection: 'courses' as const,
        ids: [publishedCourseId, draftChapterCourseId, draftCourseId],
      },
      { collection: 'categories' as const, ids: [categoryId] },
    ]
    for (const { collection, ids: docIds } of ids) {
      for (const id of docIds) {
        try {
          await payload.delete({ collection, id, overrideAccess: true })
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  })

  // ---- CONTROL: Published hierarchy works ----

  describe('queryLessonBySlug', () => {
    it('returns lesson when full hierarchy is published+active', async () => {
      const { queryLessonBySlug } = await import('@/server/repos/queries/lessons')
      const lesson = await queryLessonBySlug({ slug: publishedLessonSlug })
      expect(lesson).not.toBeNull()
      expect(lesson!.id).toBe(publishedLessonId)
    })

    /**
     * BUG REPRODUCTION: queryLessonBySlug calls findByID with overrideAccess: false
     * but without disableErrors: true. When the chapter is draft, findByID THROWS
     * NotFound instead of returning null, causing an unhandled crash → 404/500.
     *
     * EXPECTED: Returns null gracefully (lesson is invisible due to draft parent).
     * ACTUAL (before fix): Throws NotFound error.
     */
    it('returns null (not throws) when parent chapter is draft', async () => {
      const { queryLessonBySlug } = await import('@/server/repos/queries/lessons')

      // This should return null, NOT throw an error
      const lesson = await queryLessonBySlug({ slug: lessonUnderDraftChapterSlug })
      expect(lesson).toBeNull()
    })

    /**
     * BUG REPRODUCTION: Same issue but at the course (grandparent) level.
     * The chapter is published but belongs to a draft course.
     * findByID on the course with overrideAccess: false throws instead of returning null.
     */
    it('returns null (not throws) when grandparent course is draft', async () => {
      const { queryLessonBySlug } = await import('@/server/repos/queries/lessons')

      const lesson = await queryLessonBySlug({ slug: lessonUnderDraftCourseSlug })
      expect(lesson).toBeNull()
    })
  })

  describe('queryChapterBySlug', () => {
    /**
     * BUG REPRODUCTION: queryChapterBySlug calls findByID on the parent course
     * with overrideAccess: false but no disableErrors. When the course is draft,
     * this throws instead of returning null.
     */
    it('returns null (not throws) when parent course is draft', async () => {
      const { queryChapterBySlug } = await import('@/server/repos/queries/chapters')

      const chapter = await queryChapterBySlug({ slug: chapterUnderDraftCourseSlug })
      expect(chapter).toBeNull()
    })
  })

  describe('queryLessonsByChapter', () => {
    /**
     * BUG REPRODUCTION: queryLessonsByChapter calls findByID on the chapter
     * with overrideAccess: false but no disableErrors. When the chapter is draft,
     * this throws instead of returning [].
     */
    it('returns empty array (not throws) when chapter is draft', async () => {
      const { queryLessonsByChapter } = await import('@/server/repos/queries/lessons')

      const lessons = await queryLessonsByChapter({ chapterId: draftChapterId })
      expect(lessons).toEqual([])
    })

    it('returns empty array (not throws) when chapter course is draft', async () => {
      const { queryLessonsByChapter } = await import('@/server/repos/queries/lessons')

      const lessons = await queryLessonsByChapter({ chapterId: chapterUnderDraftCourseId })
      expect(lessons).toEqual([])
    })
  })

  describe('queryLessonsByCourse', () => {
    it('returns empty array (not throws) when course is draft', async () => {
      const { queryLessonsByCourse } = await import('@/server/repos/queries/lessons')

      const lessons = await queryLessonsByCourse({ courseId: draftCourseId })
      expect(lessons).toEqual([])
    })
  })
})

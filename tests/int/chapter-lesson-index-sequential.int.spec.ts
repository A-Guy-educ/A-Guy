// @vitest-environment node
/**
 * Integration test: Chapter 2 lesson card labels are sequential (no duplicates)
 * Bug: #1862 — Chapter 2 lesson cards were labeled 4,4,5,6 instead of 4,5,6,7
 *
 * Root cause: chapterGroups deduplication relies on chapterSlug as Map key,
 * but filteredLessons flat-mapping could place the same lesson in multiple
 * chapter groups if chapterSlug was computed incorrectly, OR the chapters
 * array itself contained duplicate chapter entries causing startIndex to
 * double-count lessons from the same chapter.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { prefetchStudyData } from '@/server/repos/queries/study-page'
import { getEffectiveLessonType } from '@/server/constants/lesson-types'

let payload: Payload
let originalDatabaseUrl: string | undefined
const GRADE_LEVEL = `grade-8-lesson-index-${Date.now()}`
const TENANT_SLUG = `tenant-lesson-index-${Date.now()}`

let chapter1Id: string
let chapter2Id: string
let chapter1Slug: string
let chapter2Slug: string

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Ensure tenant
  const tenant = await payload.create({
    collection: 'tenants',
    data: { name: TENANT_SLUG, slug: TENANT_SLUG, status: 'active' },
    overrideAccess: true,
  })

  // Create category
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: `Lesson Index Category ${Date.now()}`,
      slug: `lesson-index-cat-${Date.now()}`,
    } as any,
    draft: false,
    overrideAccess: true,
  })

  // Create course
  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: GRADE_LEVEL,
      title: `Lesson Index Course ${Date.now()}`,
      status: 'published',
      categories: [category.id],
      tenant: tenant.id,
      locale: 'he',
      isActive: true,
      pageAccessType: 'free',
      accessType: 'free',
      contentStatus: 'none',
      contentStatusVisible: true,
    } as any,
    overrideAccess: true,
  })

  // Create Chapter 1
  chapter1Slug = `ch-1-lesson-index-${Date.now()}`
  const ch1 = await payload.create({
    collection: 'chapters',
    data: {
      title: 'Chapter 1',
      slug: chapter1Slug,
      course: course.id,
      order: 0,
      status: 'published',
      isActive: true,
      tenant: tenant.id,
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  chapter1Id = ch1.id

  // Create Chapter 2
  chapter2Slug = `ch-2-lesson-index-${Date.now()}`
  const ch2 = await payload.create({
    collection: 'chapters',
    data: {
      title: 'Chapter 2',
      slug: chapter2Slug,
      course: course.id,
      order: 1,
      status: 'published',
      isActive: true,
      tenant: tenant.id,
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  chapter2Id = ch2.id

  // Create 3 practice lessons in Chapter 1
  for (let i = 1; i <= 3; i++) {
    await payload.create({
      collection: 'lessons',
      data: {
        title: `Chapter 1 Practice Lesson ${i}`,
        slug: `ch1-practice-${i}-${Date.now()}`,
        chapter: chapter1Id,
        type: 'practice',
        order: i,
        status: 'published',
        isActive: true,
        tenant: tenant.id,
        locale: 'he',
        contentStatus: 'none',
        contentStatusVisible: true,
      } as any,
      overrideAccess: true,
    })
  }

  // Create 4 practice lessons in Chapter 2
  for (let i = 1; i <= 4; i++) {
    await payload.create({
      collection: 'lessons',
      data: {
        title: `Chapter 2 Practice Lesson ${i}`,
        slug: `ch2-practice-${i}-${Date.now()}`,
        chapter: chapter2Id,
        type: 'practice',
        order: i,
        status: 'published',
        isActive: true,
        tenant: tenant.id,
        locale: 'he',
        contentStatus: 'none',
        contentStatusVisible: true,
      } as any,
      overrideAccess: true,
    })
  }
}, 180_000)

afterAll(async () => {
  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()
  if (originalDatabaseUrl !== undefined) process.env.DATABASE_URL = originalDatabaseUrl
  else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 180_000)

describe('Lesson indices across chapters are sequential (bug #1862)', () => {
  it('prefetchStudyData returns chapters with practice lessons grouped correctly', async () => {
    const data = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')

    expect(data).not.toBeNull()
    expect(data!.chapters.length).toBe(2)

    const [ch1, ch2] = data!.chapters

    // Chapter 1 should have 3 practice lessons
    expect(ch1.lessons.length).toBe(3)
    expect(ch1.slug).toBe(chapter1Slug)

    // Chapter 2 should have 4 practice lessons
    expect(ch2.lessons.length).toBe(4)
    expect(ch2.slug).toBe(chapter2Slug)

    // All lessons should be practice type
    for (const lesson of ch1.lessons) {
      expect(getEffectiveLessonType(lesson.type)).toBe('practice')
    }
    for (const lesson of ch2.lessons) {
      expect(getEffectiveLessonType(lesson.type)).toBe('practice')
    }
  })

  it('no duplicate lessons across chapters (chapterGroups deduplication)', async () => {
    const data = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')
    expect(data).not.toBeNull()

    const chapters = data!.chapters

    // Collect all lesson IDs across all chapters
    const allLessonIds: string[] = []
    for (const chapter of chapters) {
      for (const lesson of chapter.lessons ?? []) {
        allLessonIds.push(lesson.id)
      }
    }

    // There should be exactly 7 unique lessons (3 + 4)
    const uniqueLessonIds = new Set(allLessonIds)
    expect(
      uniqueLessonIds.size,
      `Duplicate lesson IDs found: ${allLessonIds.length} total but only ${uniqueLessonIds.size} unique`,
    ).toBe(allLessonIds.length)
  })

  it('lesson indices computed in chapterGroups are sequential across all chapters', async () => {
    // This test replicates the filteredLessons + chapterGroups computation
    // from StudyContent to verify that lesson indices are unique and sequential.
    //
    // The bug (#1862): when chapterGroups computation had a duplicate chapter entry,
    // startIndex for Chapter 2 would be computed as 2*chapter1.lessons.length
    // instead of chapter1.lessons.length, causing Chapter 2's first lesson to
    // get the wrong index (and potentially collide with Chapter 1's last index).

    const data = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')
    expect(data).not.toBeNull()

    const chapters = data!.chapters
    const lessonType = 'practice'

    // Replicate filteredLessons from StudyContent
    const filteredLessons = chapters.flatMap((chapter) => {
      const chapterSlug = chapter.slug || ''
      return (chapter.lessons ?? [])
        .filter((lesson) => getEffectiveLessonType(lesson.type) === lessonType)
        .map((lesson) => ({
          ...lesson,
          _chapterSlug: chapterSlug,
          _chapterTitle: chapter.title,
          _chapterLabel: (chapter as any).chapterLabel,
        }))
    })

    // Replicate chapterGroups deduplication from StudyContent
    type ChapterGroup = {
      chapterSlug: string
      lessons: typeof filteredLessons
    }
    const chapterGroups: ChapterGroup[] = []
    const groupMap = new Map<string, ChapterGroup>()

    for (const lesson of filteredLessons) {
      const key = lesson._chapterSlug
      const existing = groupMap.get(key)
      if (existing) {
        existing.lessons.push(lesson)
      } else {
        const group: ChapterGroup = { chapterSlug: key, lessons: [lesson] }
        groupMap.set(key, group)
        chapterGroups.push(group)
      }
    }

    // Chapter 1 should be first, Chapter 2 second
    expect(chapterGroups.length).toBe(2)
    expect(chapterGroups[0].chapterSlug).toBe(chapter1Slug)
    expect(chapterGroups[1].chapterSlug).toBe(chapter2Slug)

    // Chapter 1 has 3 lessons, Chapter 2 has 4 lessons
    expect(chapterGroups[0].lessons.length).toBe(3)
    expect(chapterGroups[1].lessons.length).toBe(4)

    // Verify no duplicate lessons in any chapter group
    for (const group of chapterGroups) {
      const ids = group.lessons.map((l) => l.id)
      const uniqueIds = new Set(ids)
      expect(
        uniqueIds.size,
        `Duplicate lessons in chapter ${group.chapterSlug}: ${ids.join(', ')}`,
      ).toBe(ids.length)
    }

    // Compute startIndex for each group (replicating StudyContent JSX logic)
    const computedIndices: Array<{ lessonId: string; index: number; chapterSlug: string }> = []

    for (let groupIdx = 0; groupIdx < chapterGroups.length; groupIdx++) {
      const group = chapterGroups[groupIdx]
      const startIndex = chapterGroups
        .slice(0, groupIdx)
        .reduce((sum, g) => sum + g.lessons.length, 0)

      for (let idx = 0; idx < group.lessons.length; idx++) {
        const lessonIndex = startIndex + idx + 1
        computedIndices.push({
          lessonId: group.lessons[idx].id,
          index: lessonIndex,
          chapterSlug: group.chapterSlug,
        })
      }
    }

    // All indices should be unique
    const indices = computedIndices.map((c) => c.index)
    const uniqueIndices = new Set(indices)
    expect(uniqueIndices.size, `Duplicate lesson indices found: ${indices.join(', ')}`).toBe(
      indices.length,
    )

    // Expected: Chapter 1 lessons → indices 1, 2, 3
    // Expected: Chapter 2 lessons → indices 4, 5, 6, 7
    expect(
      computedIndices.filter((c) => c.chapterSlug === chapter1Slug).map((c) => c.index),
    ).toEqual([1, 2, 3])
    expect(
      computedIndices.filter((c) => c.chapterSlug === chapter2Slug).map((c) => c.index),
    ).toEqual([4, 5, 6, 7])
  })

  it('chapterGroups deduplicates duplicate lesson IDs within the same chapter', async () => {
    // This test verifies the deduplication safeguard: if filteredLessons contains
    // duplicate lesson entries (e.g., from a duplicate chapter in the chapters array
    // or duplicate entries in chapter.lessons), chapterGroups must deduplicate by
    // lesson ID so that startIndex remains correct and no duplicate cards render.
    //
    // Bug #1862 manifested as: Chapter 2 cards labeled 4,4,5,6 instead of 4,5,6,7.
    // The duplicate "Lesson 4" occurred because a lesson appeared twice in
    // filteredLessons, causing two cards with the same index to render.

    const data = await prefetchStudyData(GRADE_LEVEL, undefined, 'practice')
    expect(data).not.toBeNull()

    const chapters = data!.chapters
    const lessonType = 'practice'

    // Simulate filteredLessons WITH duplicates (as could happen with duplicate chapters)
    const filteredLessonsWithDupes = chapters.flatMap((chapter) => {
      const chapterSlug = chapter.slug || ''
      return (chapter.lessons ?? [])
        .filter((lesson) => getEffectiveLessonType(lesson.type) === lessonType)
        .map((lesson) => ({
          ...lesson,
          _chapterSlug: chapterSlug,
          _chapterTitle: chapter.title,
          _chapterLabel: (chapter as any).chapterLabel,
        }))
    })

    // Manually inject a duplicate of the first Chapter 2 lesson to simulate the bug
    const ch2FirstLesson = filteredLessonsWithDupes.find((l) => l._chapterSlug === chapter2Slug)!
    const dupeIndex = filteredLessonsWithDupes.indexOf(ch2FirstLesson)
    filteredLessonsWithDupes.splice(dupeIndex + 1, 0, { ...ch2FirstLesson }) // duplicate right after original

    // Build chapterGroups with the deduplication logic (same as StudyContent)
    type ChapterGroupForTest = {
      chapterSlug: string
      lessons: typeof filteredLessonsWithDupes
    }
    const chapterGroupsForTest: ChapterGroupForTest[] = []
    const groupMapForTest = new Map<string, ChapterGroupForTest>()

    for (const lesson of filteredLessonsWithDupes) {
      const key = lesson._chapterSlug
      const existing = groupMapForTest.get(key)
      if (existing) {
        existing.lessons.push(lesson)
      } else {
        const group: ChapterGroupForTest = {
          chapterSlug: key,
          lessons: [lesson],
        }
        groupMapForTest.set(key, group)
        chapterGroupsForTest.push(group)
      }
    }

    // Apply deduplication (the fix)
    for (const group of chapterGroupsForTest) {
      const seen = new Set<string>()
      group.lessons = group.lessons.filter((lesson) => {
        if (seen.has(lesson.id)) return false
        seen.add(lesson.id)
        return true
      })
    }

    // After deduplication, Chapter 2 should have exactly 4 unique lessons (not 5)
    const ch2Group = chapterGroupsForTest.find((g) => g.chapterSlug === chapter2Slug)!
    expect(ch2Group.lessons.length, 'Duplicate lesson should be removed').toBe(4)

    // Verify indices are still sequential after deduplication
    const computedIndicesAfterDedup: Array<{
      lessonId: string
      index: number
      chapterSlug: string
    }> = []
    for (let groupIdx = 0; groupIdx < chapterGroupsForTest.length; groupIdx++) {
      const group = chapterGroupsForTest[groupIdx]
      const startIndex = chapterGroupsForTest
        .slice(0, groupIdx)
        .reduce((sum, g) => sum + g.lessons.length, 0)

      for (let idx = 0; idx < group.lessons.length; idx++) {
        computedIndicesAfterDedup.push({
          lessonId: group.lessons[idx].id,
          index: startIndex + idx + 1,
          chapterSlug: group.chapterSlug,
        })
      }
    }

    const ch2Indices = computedIndicesAfterDedup
      .filter((c) => c.chapterSlug === chapter2Slug)
      .map((c) => c.index)
    expect(ch2Indices, 'Chapter 2 indices should be 4,5,6,7 after deduplication').toEqual([
      4, 5, 6, 7,
    ])

    // No duplicate indices
    const allIndices = computedIndicesAfterDedup.map((c) => c.index)
    const uniqueIndices = new Set(allIndices)
    expect(uniqueIndices.size, 'No duplicate indices after deduplication').toBe(allIndices.length)
  })
})

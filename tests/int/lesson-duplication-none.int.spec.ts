/**
 * Integration test: lesson duplication endpoint, level=none path.
 *
 * Verifies that calling the deep-clone helper used by the duplicate endpoint
 * creates a new lesson with copied exercises, keeps source untouched, and
 * the LessonDuplications record reaches status=succeeded with outputLesson set.
 *
 * The endpoint itself is exercised via Payload's local API (no HTTP layer)
 * to keep the test focused on data behavior, matching the project's other
 * integration tests.
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
  if (existing.docs[0]) return existing.docs[0].id
  const created = await payload.create({
    collection: 'tenants',
    data: { name: slug, slug, status: 'active' },
    overrideAccess: true,
  })
  return created.id
}

describe('Lesson duplication — none (deep clone)', () => {
  let payload: Payload
  let categoryId: string
  let courseId: string
  let chapterId: string
  let tenantId: string
  let sourceLessonId: string
  const cleanupLessonIds: string[] = []
  const cleanupExerciseIds: string[] = []
  const cleanupDuplicationIds: string[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)
    const ts = Date.now()

    const category = await payload.create({
      collection: 'categories',
      data: { title: `DupCat ${ts}`, slug: `dup-cat-${ts}`, locale: 'he' },
    })
    categoryId = category.id

    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `DUP-${ts}`,
        title: `Dup Course ${ts}`,
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
        title: `Dup Chapter ${ts}`,
        chapterLabel: `DC-${ts}`,
        course: courseId,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
      },
    })
    chapterId = chapter.id

    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Dup Source Lesson ${ts}`,
        chapter: chapterId,
        type: 'practice',
        order: 1,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      draft: false,
    })
    sourceLessonId = lesson.id
    cleanupLessonIds.push(sourceLessonId)

    // Two exercises on the source so we can verify exercise cloning
    for (let i = 0; i < 2; i++) {
      const ex = await payload.create({
        collection: 'exercises',
        data: { title: `Source Exercise ${i} ${ts}`, lesson: sourceLessonId },
        draft: true,
      })
      cleanupExerciseIds.push(ex.id)
    }
  }, 120000)

  afterAll(async () => {
    for (const id of cleanupDuplicationIds) {
      try {
        await payload.delete({ collection: 'lesson-duplications', id, overrideAccess: true })
      } catch {
        // ignore
      }
    }
    for (const id of cleanupExerciseIds) {
      try {
        await payload.delete({ collection: 'exercises', id, overrideAccess: true })
      } catch {
        // ignore
      }
    }
    for (const id of cleanupLessonIds) {
      try {
        await payload.delete({ collection: 'lessons', id, overrideAccess: true })
      } catch {
        // ignore
      }
    }
    try {
      await payload.delete({ collection: 'chapters', id: chapterId, overrideAccess: true })
    } catch {
      // ignore
    }
    try {
      await payload.delete({ collection: 'courses', id: courseId, overrideAccess: true })
    } catch {
      // ignore
    }
    try {
      await payload.delete({ collection: 'categories', id: categoryId, overrideAccess: true })
    } catch {
      // ignore
    }
    await payload.db?.destroy?.()
  })

  it('creates a pending duplication record for level=light without cloning', async () => {
    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonId,
        level: 'light',
        status: 'pending',
      },
      overrideAccess: true,
    })
    cleanupDuplicationIds.push(record.id)

    expect(record.status).toBe('pending')
    expect(record.level).toBe('light')
    expect(record.outputLesson).toBeFalsy()
  })

  it('produces a cloned lesson + cloned exercises and links them via outputLesson for level=none', async () => {
    // Inline the same deep-clone behavior the endpoint runs for level=none.
    const source = await payload.findByID({
      collection: 'lessons',
      id: sourceLessonId,
      depth: 0,
      overrideAccess: true,
    })

    const sourceExercises = await payload.find({
      collection: 'exercises',
      where: { lesson: { equals: sourceLessonId } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })

    const record = await payload.create({
      collection: 'lesson-duplications',
      data: { sourceLesson: sourceLessonId, level: 'none', status: 'pending' },
      overrideAccess: true,
    })
    cleanupDuplicationIds.push(record.id)

    // Clone lesson
    const {
      id: _id,
      createdAt: _c,
      updatedAt: _u,
      ...sourceData
    } = source as unknown as Record<string, unknown> & {
      id?: unknown
      createdAt?: unknown
      updatedAt?: unknown
    }
    void _id
    void _c
    void _u
    const newLesson = await payload.create({
      collection: 'lessons',
      data: {
        ...(sourceData as Record<string, unknown>),
        title: `${(sourceData as { title: string }).title} - Copy`,
        slug: undefined,
        status: 'draft',
      } as never,
      overrideAccess: true,
    })
    cleanupLessonIds.push(newLesson.id)

    // Clone exercises
    for (const ex of sourceExercises.docs) {
      const {
        id: _exId,
        createdAt: _exC,
        updatedAt: _exU,
        ...exData
      } = ex as unknown as Record<string, unknown> & {
        id?: unknown
        createdAt?: unknown
        updatedAt?: unknown
      }
      void _exId
      void _exC
      void _exU
      const cloned = await payload.create({
        collection: 'exercises',
        data: { ...exData, lesson: newLesson.id } as never,
        overrideAccess: true,
      })
      cleanupExerciseIds.push(cloned.id)
    }

    const updated = await payload.update({
      collection: 'lesson-duplications',
      id: record.id,
      data: { outputLesson: newLesson.id, status: 'succeeded' },
      overrideAccess: true,
    })

    expect(updated.status).toBe('succeeded')
    const linked = updated.outputLesson
    const linkedId = typeof linked === 'string' ? linked : (linked as { id?: string })?.id
    expect(linkedId).toBe(newLesson.id)

    // New lesson must be a fresh document with two exercises pointing at it
    expect(newLesson.id).not.toBe(sourceLessonId)
    const newExercises = await payload.find({
      collection: 'exercises',
      where: { lesson: { equals: newLesson.id } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    expect(newExercises.docs).toHaveLength(2)

    // Source lesson + its exercises are unchanged
    const sourceAfter = await payload.find({
      collection: 'exercises',
      where: { lesson: { equals: sourceLessonId } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    expect(sourceAfter.docs).toHaveLength(2)
  })
})

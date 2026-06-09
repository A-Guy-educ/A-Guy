/**
 * Integration test: lesson-duplications list view relationship cells.
 *
 * Verifies that the lesson-duplications admin list query properly populates
 * sourceLesson and outputLesson relationship fields with title data.
 * This is required for the custom SourceLessonCell and OutputLessonCell
 * components to render lesson titles instead of "Loading...".
 *
 * Issue: #2572
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

describe('LessonDuplications list view relationship cells', () => {
  let payload: Payload
  let categoryId: string
  let courseId: string
  let chapterId: string
  let tenantId: string
  let sourceLessonId: string
  let outputLessonId: string
  let duplicationRecordId: string
  const cleanupLessonIds: string[] = []
  const cleanupDuplicationIds: string[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)
    const ts = Date.now()

    const category = await payload.create({
      collection: 'categories',
      data: { title: `RelCellCat ${ts}`, slug: `rel-cell-cat-${ts}`, locale: 'he' },
    })
    categoryId = category.id

    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `RCC-${ts}`,
        title: `Rel Cell Course ${ts}`,
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
    })
    courseId = course.id

    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        title: `Rel Cell Chapter ${ts}`,
        chapterLabel: `RCH-${ts}`,
        course: courseId,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
      },
    })
    chapterId = chapter.id

    const sourceLesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Source Lesson For Rel Cells ${ts}`,
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
    sourceLessonId = sourceLesson.id
    cleanupLessonIds.push(sourceLessonId)

    const outputLesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Output Lesson For Rel Cells ${ts}`,
        chapter: chapterId,
        type: 'practice',
        order: 2,
        status: 'draft',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      draft: true,
    })
    outputLessonId = outputLesson.id
    cleanupLessonIds.push(outputLessonId)

    // Create a duplication record with both source and output lessons set
    const duplication = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonId,
        level: 'medium',
        status: 'needs_review',
        outputLesson: outputLessonId,
        outputExercises: [],
        failures: [],
      },
      overrideAccess: true,
    })
    duplicationRecordId = duplication.id
    cleanupDuplicationIds.push(duplicationRecordId)
  }, 60000)

  afterAll(async () => {
    for (const id of cleanupDuplicationIds) {
      try {
        await payload.delete({ collection: 'lesson-duplications', id, overrideAccess: true })
      } catch {
        /* ignore */
      }
    }
    for (const id of cleanupLessonIds) {
      try {
        await payload.delete({ collection: 'lessons', id, overrideAccess: true })
      } catch {
        /* ignore */
      }
    }
    try {
      await payload.delete({ collection: 'chapters', id: chapterId, overrideAccess: true })
    } catch {
      /* ignore */
    }
    try {
      await payload.delete({ collection: 'courses', id: courseId, overrideAccess: true })
    } catch {
      /* ignore */
    }
    try {
      await payload.delete({ collection: 'categories', id: categoryId, overrideAccess: true })
    } catch {
      /* ignore */
    }
    await payload.db?.destroy?.()
  })

  it('sourceLesson relationship is populated with title in list query (depth=2)', async () => {
    // Query the lesson-duplications collection with depth=2 to populate relationships
    // This simulates what the admin list view does when rendering cells
    const result = await payload.find({
      collection: 'lesson-duplications',
      where: { id: { equals: duplicationRecordId } },
      depth: 2,
      limit: 1,
      overrideAccess: true,
    })

    expect(result.docs).toHaveLength(1)
    const doc = result.docs[0]

    // sourceLesson should be a populated object, not just a string ID
    const sourceLesson = doc.sourceLesson as unknown as { id: string; title?: string } | string
    expect(sourceLesson).not.toBeNull()
    expect(typeof sourceLesson === 'object').toBe(true)
    if (typeof sourceLesson === 'object' && sourceLesson !== null) {
      expect(sourceLesson.title).toContain('Source Lesson For Rel Cells')
    }
  })

  it('outputLesson relationship is populated with title in list query (depth=2)', async () => {
    const result = await payload.find({
      collection: 'lesson-duplications',
      where: { id: { equals: duplicationRecordId } },
      depth: 2,
      limit: 1,
      overrideAccess: true,
    })

    expect(result.docs).toHaveLength(1)
    const doc = result.docs[0]

    // outputLesson should be a populated object, not just a string ID
    const outputLesson = doc.outputLesson as unknown as
      | { id: string; title?: string }
      | string
      | null
    expect(outputLesson).not.toBeNull()
    expect(typeof outputLesson === 'object').toBe(true)
    if (typeof outputLesson === 'object' && outputLesson !== null) {
      expect(outputLesson.title).toContain('Output Lesson For Rel Cells')
    }
  })

  it('outputLesson can be null for pending records', async () => {
    // Create a pending record with no output lesson yet
    const pendingRecord = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonId,
        level: 'medium',
        status: 'pending',
        // outputLesson not set — should be null
      },
      overrideAccess: true,
    })
    cleanupDuplicationIds.push(pendingRecord.id)

    // Query with depth=2
    const result = await payload.find({
      collection: 'lesson-duplications',
      where: { id: { equals: pendingRecord.id } },
      depth: 2,
      limit: 1,
      overrideAccess: true,
    })

    expect(result.docs).toHaveLength(1)
    const doc = result.docs[0]

    // outputLesson should be null (not set)
    expect(doc.outputLesson).toBeNull()
  })
})

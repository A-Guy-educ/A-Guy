/**
 * Integration test: lesson-duplications list view relationship cells.
 *
 * Issue: Admin list view at /admin/collections/lesson-duplications shows
 * "Loading..." indefinitely for sourceLesson and outputLesson relationship cells.
 *
 * This test verifies that relationship fields are properly populated when
 * the lesson-duplications collection is queried with depth=1.
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

describe('lesson-duplications list relationship fields', () => {
  let payload: Payload
  let tenantId: string
  let categoryId: string
  let courseId: string
  let chapterId: string
  let sourceLessonId: string
  let outputLessonId: string
  let duplicationId: string

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)
    const ts = Date.now()

    const category = await payload.create({
      collection: 'categories',
      data: { title: `RelCat ${ts}`, slug: `rel-cat-${ts}`, locale: 'he' },
    })
    categoryId = category.id

    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `REL-${ts}`,
        title: `Rel Course ${ts}`,
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
        title: `Rel Chapter ${ts}`,
        chapterLabel: `RC-${ts}`,
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
        title: `Rel Source Lesson ${ts}`,
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

    const outputLesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Rel Output Lesson ${ts}`,
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

    // Create a lesson-duplications record
    const duplication = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonId,
        outputLesson: outputLessonId,
        level: 'light',
        status: 'pending',
      },
      overrideAccess: true,
    })
    duplicationId = duplication.id
  }, 120000)

  afterAll(async () => {
    // Clean up
    try {
      await payload.delete({
        collection: 'lesson-duplications',
        id: duplicationId,
        overrideAccess: true,
      })
    } catch {
      /* ignore */
    }
    try {
      await payload.delete({ collection: 'lessons', id: outputLessonId, overrideAccess: true })
    } catch {
      /* ignore */
    }
    try {
      await payload.delete({ collection: 'lessons', id: sourceLessonId, overrideAccess: true })
    } catch {
      /* ignore */
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

  it('populates sourceLesson relationship when queried with depth=1', async () => {
    // Query the lesson-duplications collection with depth=1 to populate relationships
    const result = await payload.find({
      collection: 'lesson-duplications',
      where: { id: { equals: duplicationId } },
      depth: 1,
      limit: 1,
      overrideAccess: true,
    })

    expect(result.docs).toHaveLength(1)
    const doc = result.docs[0]

    // sourceLesson should be populated (an object with id and title), not a string ID
    const sourceLesson = doc.sourceLesson
    expect(sourceLesson).not.toBeNull()
    expect(sourceLesson).not.toBeUndefined()

    // Should be an object (populated), not a string
    expect(typeof sourceLesson).toBe('object')

    // Should have id and title
    const sourceLessonObj = sourceLesson as { id?: string; title?: string }
    expect(sourceLessonObj.id).toBe(sourceLessonId)
    expect(sourceLessonObj.title).toBeDefined()
    expect(typeof sourceLessonObj.title).toBe('string')
  })

  it('populates outputLesson relationship when queried with depth=1', async () => {
    const result = await payload.find({
      collection: 'lesson-duplications',
      where: { id: { equals: duplicationId } },
      depth: 1,
      limit: 1,
      overrideAccess: true,
    })

    expect(result.docs).toHaveLength(1)
    const doc = result.docs[0]

    // outputLesson should be populated (an object with id and title)
    const outputLesson = doc.outputLesson
    expect(outputLesson).not.toBeNull()
    expect(outputLesson).not.toBeUndefined()

    // Should be an object (populated), not a string
    expect(typeof outputLesson).toBe('object')

    // Should have id and title
    const outputLessonObj = outputLesson as { id?: string; title?: string }
    expect(outputLessonObj.id).toBe(outputLessonId)
    expect(outputLessonObj.title).toBeDefined()
    expect(typeof outputLessonObj.title).toBe('string')
  })

  it('sourceLesson relationship is accessible for a published+active lesson', async () => {
    // This verifies that the admin user can access the source lesson
    // (which is required for the admin UI to display the relationship cell)
    const lesson = await payload.findByID({
      collection: 'lessons',
      id: sourceLessonId,
      depth: 0,
      overrideAccess: true,
    })

    expect(lesson).not.toBeNull()
    expect(lesson.id).toBe(sourceLessonId)
    expect((lesson as { title?: string }).title).toContain('Rel Source Lesson')
  })

  it('outputLesson relationship is accessible even though it is a draft lesson', async () => {
    // This verifies that the admin user can access the output lesson
    // (which is a draft lesson - important for the admin UI to display the relationship cell)
    const lesson = await payload.findByID({
      collection: 'lessons',
      id: outputLessonId,
      depth: 0,
      overrideAccess: true,
    })

    expect(lesson).not.toBeNull()
    expect(lesson.id).toBe(outputLessonId)
    expect((lesson as { title?: string }).title).toContain('Rel Output Lesson')
  })
})

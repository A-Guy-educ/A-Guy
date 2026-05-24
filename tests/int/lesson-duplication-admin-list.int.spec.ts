/**
 * Integration test: lesson duplication admin list — relationship fields.
 *
 * Bug #1959: The /admin/lesson-duplications list view shows "Loading..."
 * for sourceLesson and outputLesson columns instead of lesson titles.
 *
 * This test verifies that when LessonDuplications records are queried,
 * the sourceLesson and outputLesson relationship fields are returned as
 * populated objects (with id and title) when a sufficient depth is used,
 * so the admin list can display lesson titles without needing per-row fetches.
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

describe('LessonDuplications admin list — relationship field resolution', () => {
  let payload: Payload
  let categoryId: string
  let courseId: string
  let chapterId: string
  let tenantId: string
  let sourceLessonId: string
  let outputLessonId: string
  const cleanupLessonIds: string[] = []
  const cleanupDuplicationIds: string[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)
    const ts = Date.now()

    const category = await payload.create({
      collection: 'categories',
      data: { title: `AdminListCat ${ts}`, slug: `admin-list-cat-${ts}`, locale: 'he' },
    })
    categoryId = category.id

    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `AL-${ts}`,
        title: `Admin List Course ${ts}`,
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
        title: `Admin List Chapter ${ts}`,
        locale: 'he',
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        course: courseId,
      },
      draft: false,
    })
    chapterId = chapter.id

    const sourceLesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Source Lesson for Admin List ${ts}`,
        type: 'practice',
        status: 'published',
        isActive: true,
        tenant: tenantId,
        chapter: chapterId,
        locale: 'he',
        order: 0,
        accessType: 'free',
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
        title: `Output Lesson for Admin List ${ts}`,
        type: 'practice',
        status: 'draft',
        isActive: true,
        tenant: tenantId,
        chapter: chapterId,
        locale: 'he',
        order: 0,
        accessType: 'free',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      draft: true,
    })
    outputLessonId = outputLesson.id
    cleanupLessonIds.push(outputLessonId)
  })

  afterAll(async () => {
    for (const id of cleanupDuplicationIds) {
      try {
        await payload.delete({ collection: 'lesson-duplications', id, overrideAccess: true })
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

  it('lesson-duplications list with depth=0 returns sourceLesson as an ID string', async () => {
    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonId,
        outputLesson: outputLessonId,
        level: 'light',
        status: 'pending',
      },
      overrideAccess: true,
    })
    cleanupDuplicationIds.push(record.id)

    // With depth=0 (default for list), relationships are returned as ID strings
    const found = await payload.find({
      collection: 'lesson-duplications',
      where: { id: { equals: record.id } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })

    expect(found.docs).toHaveLength(1)
    const doc = found.docs[0] as unknown as Record<string, unknown>
    // At depth=0, relationships come back as ID strings (this is the expected behavior)
    expect(typeof doc.sourceLesson).toBe('string')
    expect(doc.sourceLesson).toBe(sourceLessonId)
    expect(typeof doc.outputLesson).toBe('string')
    expect(doc.outputLesson).toBe(outputLessonId)
  })

  it('lesson-duplications list with depth=1 returns sourceLesson and outputLesson as populated objects with id and title', async () => {
    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonId,
        outputLesson: outputLessonId,
        level: 'medium',
        status: 'pending',
      },
      overrideAccess: true,
    })
    cleanupDuplicationIds.push(record.id)

    // With depth=1, relationships are populated with their full data
    const found = await payload.find({
      collection: 'lesson-duplications',
      where: { id: { equals: record.id } },
      depth: 1,
      limit: 1,
      overrideAccess: true,
    })

    expect(found.docs).toHaveLength(1)
    const doc = found.docs[0] as unknown as Record<string, unknown>

    // At depth=1, relationships come back as populated objects
    const sourceLesson = doc.sourceLesson as Record<string, unknown> | null
    expect(sourceLesson).not.toBeNull()
    expect(sourceLesson).toHaveProperty('id')
    expect(sourceLesson).toHaveProperty('title')
    expect((sourceLesson as Record<string, unknown>).id).toBe(sourceLessonId)

    const outputLesson = doc.outputLesson as Record<string, unknown> | null
    expect(outputLesson).not.toBeNull()
    expect(outputLesson).toHaveProperty('id')
    expect((outputLesson as Record<string, unknown>).id).toBe(outputLessonId)
  })
})

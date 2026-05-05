/**
 * @fileType integration-test
 * @domain lessons
 * @pattern visible-renderers
 * @ai-summary Integration tests for the `visibleRenderers` field on lessons:
 *             schema defaults, validation, and Payload API integration.
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

describe('Lesson visibleRenderers field', () => {
  let payload: Payload
  let tenantId: string
  let categoryId: string
  let courseId: string
  let chapterId: string
  const lessonIds: string[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)
    const timestamp = Date.now()

    const category = await payload.create({
      collection: 'categories',
      data: {
        title: `VR Category ${timestamp}`,
        slug: `vr-category-${timestamp}`,
        locale: 'he',
      },
    })
    categoryId = category.id

    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `VR-${timestamp}`,
        title: `Visible Renderers Course ${timestamp}`,
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
        title: `Visible Renderers Chapter ${timestamp}`,
        chapterLabel: `VR-${timestamp}`,
        course: courseId,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
      },
    })
    chapterId = chapter.id
  })

  afterAll(async () => {
    for (const lessonId of lessonIds) {
      try {
        await payload.delete({ collection: 'lessons', id: lessonId })
      } catch {
        // Ignore cleanup errors
      }
    }
    try {
      await payload.delete({ collection: 'chapters', id: chapterId })
    } catch {
      // Ignore cleanup errors
    }
    try {
      await payload.delete({ collection: 'courses', id: courseId })
    } catch {
      // Ignore cleanup errors
    }
    try {
      await payload.delete({ collection: 'categories', id: categoryId })
    } catch {
      // Ignore cleanup errors
    }
    await payload.db?.destroy?.()
  })

  const baseLessonData = (order: number) => ({
    title: `Visible Renderers Lesson ${order}`,
    chapter: chapterId,
    type: 'learning' as const,
    order,
    status: 'published' as const,
    isActive: true,
    tenant: tenantId,
    locale: 'he' as 'he',
    accessType: 'inherit' as const,
    contentStatus: 'none' as const,
    contentStatusVisible: true,
  })

  it('defaults to all three renderers on create', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        ...baseLessonData(1),
      },
      draft: false,
    })
    lessonIds.push(lesson.id)
    expect(lesson.visibleRenderers).toEqual(['media', 'pdf', 'interactive'])
  })

  it('accepts a subset of renderers on create', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        ...baseLessonData(2),
        visibleRenderers: ['pdf'],
      },
      draft: false,
    })
    lessonIds.push(lesson.id)
    expect(lesson.visibleRenderers).toEqual(['pdf'])
  })

  it('accepts two renderers on create', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        ...baseLessonData(3),
        visibleRenderers: ['media', 'interactive'],
      },
      draft: false,
    })
    lessonIds.push(lesson.id)
    expect(lesson.visibleRenderers).toEqual(['media', 'interactive'])
  })

  it('rejects an empty renderers array on create', async () => {
    await expect(
      payload.create({
        collection: 'lessons',
        data: {
          ...baseLessonData(4),
          visibleRenderers: [],
        },
        draft: false,
      }),
    ).rejects.toThrow(/At least one renderer must be visible/)
  })

  it('rejects an invalid renderer value on create', async () => {
    await expect(
      payload.create({
        collection: 'lessons',
        data: {
          ...baseLessonData(5),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          visibleRenderers: ['media', 'video'] as any,
        },
        draft: false,
      }),
    ).rejects.toThrow(/invalid value/)
  })

  it('allows updating visibleRenderers to a subset', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        ...baseLessonData(6),
        visibleRenderers: ['media', 'pdf', 'interactive'],
      },
      draft: false,
    })
    lessonIds.push(lesson.id)

    const updated = await payload.update({
      collection: 'lessons',
      id: lesson.id,
      data: { visibleRenderers: ['media', 'interactive'] },
      overrideAccess: true,
    })
    expect(updated.visibleRenderers).toEqual(['media', 'interactive'])
  })

  it('rejects update that clears all renderers', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        ...baseLessonData(7),
      },
      draft: false,
    })
    lessonIds.push(lesson.id)

    await expect(
      payload.update({
        collection: 'lessons',
        id: lesson.id,
        data: { visibleRenderers: [] },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/At least one renderer must be visible/)
  })

  it('rejects update with invalid renderer value', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        ...baseLessonData(8),
      },
      draft: false,
    })
    lessonIds.push(lesson.id)

    await expect(
      payload.update({
        collection: 'lessons',
        id: lesson.id,
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          visibleRenderers: ['pdf', 'invalid'] as any,
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/invalid value/)
  })

  it('queryLessonBySlug returns visibleRenderers', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        ...baseLessonData(9),
        visibleRenderers: ['pdf'],
      },
      draft: false,
    })
    lessonIds.push(lesson.id)

    // queryLessonBySlug is the function used by the lesson page
    const { queryLessonBySlug } = await import('@/server/repos/queries/lessons')
    const fetched = await queryLessonBySlug({ slug: lesson.slug as string })
    expect(fetched).not.toBeNull()
    expect(fetched?.visibleRenderers).toEqual(['pdf'])
  })
})

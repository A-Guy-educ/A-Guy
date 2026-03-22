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

describe('Lesson types', () => {
  let payload: Payload
  let categoryId: string
  let courseId: string
  let chapterId: string
  let tenantId: string
  const lessonIds: string[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)
    const timestamp = Date.now()
    const category = await payload.create({
      collection: 'categories',
      data: {
        title: `Lesson Types Category ${timestamp}`,
        slug: `lesson-types-category-${timestamp}`,
        locale: 'he',
      },
    })
    categoryId = category.id
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `LT-${timestamp}`,
        title: `Lesson Types Course ${timestamp}`,
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
        title: `Lesson Types Chapter ${timestamp}`,
        chapterLabel: `L-${timestamp}`,
        course: courseId,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
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

  it('creates a lesson with an explicit type', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Practice Lesson',
        chapter: chapterId,
        type: 'practice',
        order: 1,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      draft: false,
    })
    lessonIds.push(lesson.id)
    expect(lesson.type).toBe('practice')
  })

  it('defaults to learning when type is omitted', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Default Type Lesson',
        chapter: chapterId,
        order: 2,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentionally omitting 'type' to test default
        contentStatus: 'none',
        contentStatusVisible: true,
      } as any,
      draft: false,
    })
    lessonIds.push(lesson.id)
    expect(lesson.type).toBe('learning')
  })

  it('allows updating the lesson type', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Changeable Lesson',
        chapter: chapterId,
        type: 'learning',
        order: 3,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      draft: false,
    })
    lessonIds.push(lesson.id)
    const updated = await payload.update({
      collection: 'lessons',
      id: lesson.id,
      data: { type: 'exam' },
    })
    expect(updated.type).toBe('exam')
  })

  it('rejects invalid lesson types', async () => {
    await expect(
      payload.create({
        collection: 'lessons',
        data: {
          title: 'Invalid Type Lesson',
          chapter: chapterId,
          type: 'invalid' as 'learning',
          order: 4,
          status: 'published',
          isActive: true,
          tenant: tenantId,
          accessType: 'inherit',
          contentStatus: 'none',
          contentStatusVisible: true,
        },
        draft: false,
      }),
    ).rejects.toThrow()
  })
})

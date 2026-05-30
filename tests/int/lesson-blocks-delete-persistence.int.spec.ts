/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { AccountRole } from '@/infra/auth/roles'
import { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'
import { populateLessonBlocks } from '@/server/payload/migrations/populateLessonBlocks'

interface BlockEntry {
  id: string
  blockType: 'exerciseRef' | 'contentPageRef'
  exercise?: string
  contentPage?: string
}

function parseBlocks(raw: unknown): BlockEntry[] {
  if (Array.isArray(raw)) return raw as BlockEntry[]
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as BlockEntry[]
    } catch {
      // ignore
    }
  }
  return []
}

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

describe('Lesson blocks — deletion persistence', () => {
  let payload: Payload
  let tenantId: string
  let categoryId: string
  let courseId: string
  let chapterId: string

  let adminReq: any
  const lessonIds: string[] = []
  const exerciseIds: string[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)
    const timestamp = Date.now()
    const admin = await payload.create({
      collection: 'users',
      data: {
        email: `blocks-delete-admin-${timestamp}@test.local`,
        password: 'test-password-1234',
        name: 'Blocks Delete Admin',
      } as any,
    })
    await payload.update({
      collection: 'users',
      id: admin.id,

      data: { role: AccountRole.Admin } as any,
      overrideAccess: true,
    })
    const adminUser = await payload.findByID({
      collection: 'users',
      id: admin.id,
      overrideAccess: true,
    })
    adminReq = { user: adminUser }
    const category = await payload.create({
      collection: 'categories',
      data: {
        title: `Blocks Delete Category ${timestamp}`,
        slug: `blocks-delete-category-${timestamp}`,
        locale: 'he',
      },
    })
    categoryId = category.id
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `BD-${timestamp}`,
        title: `Blocks Delete Course ${timestamp}`,
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
        title: `Blocks Delete Chapter ${timestamp}`,
        chapterLabel: `BD-${timestamp}`,
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
    for (const id of exerciseIds) {
      try {
        await payload.delete({ collection: 'exercises', id, overrideAccess: true })
      } catch {
        /* ignore */
      }
    }
    for (const id of lessonIds) {
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

  it('does not re-add a deleted exercise block when the exercise is later updated', async () => {
    const lesson = await payload.create({
      collection: 'lessons',

      data: {
        title: 'Block Persistence Lesson',
        chapter: chapterId,
        type: 'learning',
        order: 100,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
      } as any,
      draft: false,
    })
    lessonIds.push(lesson.id)

    const exercise = await payload.create({
      collection: 'exercises',

      data: {
        title: 'Exercise To Be Removed',
        lesson: lesson.id,
        order: 1,
        tenant: tenantId,
      } as any,
      overrideAccess: true,
      req: adminReq,
      draft: true,
    })
    exerciseIds.push(exercise.id)

    // After create, afterChange should have appended the block.
    const afterCreate = await payload.findByID({
      collection: 'lessons',
      id: lesson.id,
      depth: 0,
      overrideAccess: true,
    })
    const initialBlocks = parseBlocks(afterCreate.blocks)
    expect(initialBlocks.some((b) => b.exercise === exercise.id)).toBe(true)

    // Admin removes the block from the lesson (simulates LessonBlocksField delete + save).
    await payload.update({
      collection: 'lessons',
      id: lesson.id,
      data: { blocks: JSON.stringify([]) },
      overrideAccess: true,
    })

    // Editing the exercise (lesson unchanged) must not re-add the block.
    await payload.update({
      collection: 'exercises',
      id: exercise.id,
      data: { title: 'Exercise Renamed' },
      overrideAccess: true,
      req: adminReq,
    })

    const afterEdit = await payload.findByID({
      collection: 'lessons',
      id: lesson.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(parseBlocks(afterEdit.blocks)).toEqual([])
  })

  it(
    'populateLessonBlocks migration skips lessons with curated (non-empty) blocks',
    { timeout: 120_000 },
    async () => {
      const lesson = await payload.create({
        collection: 'lessons',

        data: {
          title: 'Curated Blocks Lesson',
          chapter: chapterId,
          type: 'learning',
          order: 101,
          status: 'published',
          isActive: true,
          tenant: tenantId,
          locale: 'he',
          accessType: 'inherit',
          contentStatus: 'none',
          contentStatusVisible: true,
        } as any,
        draft: false,
      })
      lessonIds.push(lesson.id)

      // Two exercises exist for this lesson, but admin has curated blocks to keep only one.
      const keep = await payload.create({
        collection: 'exercises',

        data: { title: 'Keep', lesson: lesson.id, order: 1, tenant: tenantId } as any,
        overrideAccess: true,
        req: adminReq,
        draft: true,
      })
      exerciseIds.push(keep.id)
      const removed = await payload.create({
        collection: 'exercises',

        data: { title: 'Removed', lesson: lesson.id, order: 2, tenant: tenantId } as any,
        overrideAccess: true,
        req: adminReq,
        draft: true,
      })
      exerciseIds.push(removed.id)

      const curated = [{ id: 'curated1', blockType: 'exerciseRef' as const, exercise: keep.id }]
      await payload.update({
        collection: 'lessons',
        id: lesson.id,
        data: { blocks: JSON.stringify(curated) },
        overrideAccess: true,
      })

      await populateLessonBlocks(payload)

      const after = await payload.findByID({
        collection: 'lessons',
        id: lesson.id,
        depth: 0,
        overrideAccess: true,
      })
      const blocks = parseBlocks(after.blocks)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].exercise).toBe(keep.id)
    },
  )
})

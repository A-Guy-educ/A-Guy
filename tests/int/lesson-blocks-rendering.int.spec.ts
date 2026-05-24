/**
 * @fileType integration-test
 * @domain lessons
 * @pattern lesson-blocks
 * @ai-summary Integration test for issue #1979: lesson page renders nearly empty.
 *             Tests queryLessonBlocks with blocks that contain both exerciseRefs
 *             and contentPageRefs, verifying that resolved blocks are returned correctly.
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

describe('queryLessonBlocks rendering (issue #1979)', () => {
  let payload: Payload
  let tenantId: string
  let categoryId: string
  let courseId: string
  let chapterId: string
  let lessonId: string
  let exerciseId: string
  let contentPageId: string

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)
    const timestamp = Date.now()

    const category = await payload.create({
      collection: 'categories',
      data: {
        title: `Blocks Rendering Category ${timestamp}`,
        slug: `blocks-rendering-cat-${timestamp}`,
        locale: 'he',
      },
      overrideAccess: true,
    })
    categoryId = category.id

    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `BR-${timestamp}`,
        title: `Blocks Rendering Course ${timestamp}`,
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
        title: `Blocks Rendering Chapter ${timestamp}`,
        chapterLabel: `BR-${timestamp}`,
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

    // Create the lesson first (needed for exercise relationship)
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Blocks Rendering Lesson ${timestamp}`,
        slug: `blocks-rendering-lesson-${timestamp}`,
        chapter: chapterId,
        type: 'practice',
        order: 1,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
        accessType: 'free',
        contentStatus: 'none',
        contentStatusVisible: true,
        blocks: '[]',
      },
      overrideAccess: true,
      draft: false,
    })
    lessonId = lesson.id

    // Create an exercise linked to this lesson - no content field so DEFAULT_CONTENT is used
    const exercise = await payload.create({
      collection: 'exercises',
      data: {
        title: `Test Exercise ${timestamp}`,
        lesson: lessonId,
      } as any,
      overrideAccess: true,
      draft: false,
    })
    exerciseId = exercise.id

    // Create a content page linked to this lesson
    const contentPage = await payload.create({
      collection: 'content-pages',
      data: {
        title: `Test Content Page ${timestamp}`,
        slug: `test-content-page-${timestamp}`,
        status: 'published',
        isActive: true,
        lesson: lessonId,
        body: [
          {
            id: 'block-1',
            blockType: 'content',
            columns: [],
          },
        ],
      } as any,
      overrideAccess: true,
      draft: false,
    })
    contentPageId = contentPage.id

    // Now update the lesson to include both blocks
    const blocksValue = JSON.stringify([
      { id: 'lesson-block-1', blockType: 'exerciseRef', exercise: exerciseId },
      { id: 'lesson-block-2', blockType: 'contentPageRef', contentPage: contentPageId },
    ])
    await payload.update({
      collection: 'lessons',
      id: lessonId,
      data: { blocks: blocksValue },
      overrideAccess: true,
    })
  }, 120000)

  afterAll(async () => {
    try {
      await payload.delete({ collection: 'lessons', id: lessonId, overrideAccess: true })
    } catch {}
    try {
      await payload.delete({ collection: 'exercises', id: exerciseId, overrideAccess: true })
    } catch {}
    try {
      await payload.delete({ collection: 'content-pages', id: contentPageId, overrideAccess: true })
    } catch {}
    try {
      await payload.delete({ collection: 'chapters', id: chapterId, overrideAccess: true })
    } catch {}
    try {
      await payload.delete({ collection: 'courses', id: courseId, overrideAccess: true })
    } catch {}
    try {
      await payload.delete({ collection: 'categories', id: categoryId, overrideAccess: true })
    } catch {}
    try {
      await payload.db?.destroy?.()
    } catch {}
  })

  it('queryLessonBySlug returns the lesson with blocks', async () => {
    const { queryLessonBySlug } = await import('@/server/repos/queries/lessons')
    const allLessons = await payload.find({
      collection: 'lessons',
      where: { id: { equals: lessonId } },
      limit: 1,
      overrideAccess: true,
    })
    expect(allLessons.docs[0]).toBeDefined()
    const lessonSlug = allLessons.docs[0]!.slug as string
    const fetched = await queryLessonBySlug({ slug: lessonSlug })
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(lessonId)
  })

  it('queryLessonBlocks returns blocks for a lesson with blocks field', async () => {
    const { queryLessonBlocks } = await import('@/server/repos/queries/lesson-blocks')
    const blocks = await queryLessonBlocks({ lessonId })
    expect(blocks.length).toBe(2)
  })

  it('queryLessonBlocks returns exercise block with exercise data', async () => {
    const { queryLessonBlocks } = await import('@/server/repos/queries/lesson-blocks')
    const blocks = await queryLessonBlocks({ lessonId })
    const exerciseBlock = blocks.find((b) => b.type === 'exercise')
    expect(exerciseBlock).toBeDefined()
    expect(exerciseBlock?.type).toBe('exercise')
    expect((exerciseBlock as any).data.title).toBeDefined()
    expect((exerciseBlock as any).data.content).toBeDefined()
  })

  it('queryLessonBlocks returns contentPage block with contentPage data', async () => {
    const { queryLessonBlocks } = await import('@/server/repos/queries/lesson-blocks')
    const blocks = await queryLessonBlocks({ lessonId })
    const contentPageBlock = blocks.find((b) => b.type === 'contentPage')
    expect(contentPageBlock).toBeDefined()
    expect(contentPageBlock?.type).toBe('contentPage')
    expect((contentPageBlock as any).data.title).toBeDefined()
  })

  it('hasRenderableBlocks returns true for exercise with blocks', async () => {
    const { queryLessonBlocks } = await import('@/server/repos/queries/lesson-blocks')
    const blocks = await queryLessonBlocks({ lessonId })

    const hasRenderableBlocks = (exercise: any): boolean => {
      const content = exercise.content as { blocks?: unknown } | null | undefined
      if (!content || !Array.isArray(content.blocks)) return false
      return content.blocks.length > 0
    }

    const exerciseBlock = blocks.find((b) => b.type === 'exercise')
    expect(exerciseBlock).toBeDefined()
    expect(hasRenderableBlocks((exerciseBlock as any).data)).toBe(true)
  })
})

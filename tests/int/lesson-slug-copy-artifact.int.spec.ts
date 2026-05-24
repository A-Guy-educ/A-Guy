/**
 * Integration test: Lesson slug should not contain unencoded " - Copy" artifact after duplication.
 *
 * Bug: When a lesson is duplicated, the URL slug contains unencoded space and literal
 * " - Copy" suffix (e.g., "/lessons/translate-local-lesson-4-en-196407 - Copy").
 *
 * Expected: Slugs should be auto-generated from the title, producing clean URL-safe
 * slugs without spaces or literal " - Copy" text.
 *
 * Reproduction:
 * 1. Create a source lesson with a slug
 * 2. Create a duplicate (simulating duplication pipeline deepCloneLesson flow)
 *    - new lesson title = "Source Title - Copy" (mimics Payload duplicate)
 *    - slug should be regenerated from the new title
 * 3. Verify the duplicate's slug contains no spaces and no " - Copy" artifact
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

import { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'

let payload: Payload
let originalDatabaseUrl: string | undefined
let tenantId: string
let categoryId: string
let courseId: string
let chapterId: string
const cleanupLessonIds: string[] = []

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

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  payload = await getPayload({ config })

  tenantId = await ensureDefaultTenant(payload)

  const ts = Date.now()

  const category = await payload.create({
    collection: 'categories',
    data: { title: `Slug Copy Test Cat ${ts}`, slug: `slug-copy-cat-${ts}`, locale: 'he' },
  })
  categoryId = category.id

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: `SC-${ts}`,
      title: `Slug Copy Test Course ${ts}`,
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
      title: `Slug Copy Test Chapter ${ts}`,
      chapterLabel: `SCCh-${ts}`,
      course: courseId,
      order: 0,
      status: 'published',
      isActive: true,
      tenant: tenantId,
      locale: 'he',
    },
  })
  chapterId = chapter.id
}, 120_000)

afterAll(async () => {
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

  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

describe('Lesson slug should not contain unencoded " - Copy" artifact', () => {
  it('duplicated lesson slug should not contain spaces or literal " - Copy"', async () => {
    const ts = Date.now()

    // Create source lesson with a pre-defined slug (simulating a real lesson in the system)
    const sourceLesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Source Lesson ${ts}`,
        slug: `source-lesson-${ts}`,
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
      overrideAccess: true,
    })
    cleanupLessonIds.push(sourceLesson.id)

    // Simulate the duplication flow (mimics deepCloneLesson in duplicate.ts):
    // - title becomes "Source Lesson {ts} - Copy"
    // - slug is NOT explicitly set (undefined) → hook should generate from title
    const duplicatedLesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `${sourceLesson.title} - Copy`,
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
      overrideAccess: true,
    })
    cleanupLessonIds.push(duplicatedLesson.id)

    // The slug should NOT contain spaces or literal " - Copy"
    expect(duplicatedLesson.slug).toBeDefined()
    expect(typeof duplicatedLesson.slug === 'string').toBe(true)

    // Critical assertions: slug must be URL-safe
    const slug = duplicatedLesson.slug as string
    expect(slug).not.toContain(' ') // No unencoded spaces
    expect(slug).not.toContain(' - Copy') // No literal copy artifact
    expect(slug).not.toContain('Copy') // No copy text at all

    // The slug should be derived from the title "Source Lesson {ts} - Copy"
    // which should produce something like "source-lesson-{ts}---copy"
    // It should NOT contain the literal " - Copy" string
    expect(slug.toLowerCase()).not.toContain('copy')
  })

  it('lesson with " - Copy" in slug field should have it stripped on update', async () => {
    const ts = Date.now()

    // Create a lesson and then manually set a slug with " - Copy" (simulating
    // what Payload's built-in duplicate does when it copies the slug field)
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: `Cleanup Test ${ts}`,
        slug: `cleanup-test-${ts}`,
        chapter: chapterId,
        type: 'practice',
        order: 3,
        status: 'draft',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      draft: true,
      overrideAccess: true,
    })
    cleanupLessonIds.push(lesson.id)

    // Manually set a slug with " - Copy" (simulating Payload's duplicate behavior
    // where the slug is copied from the source)
    const updatedLesson = await payload.update({
      collection: 'lessons',
      id: lesson.id,
      data: {
        slug: `cleanup-test-${ts} - Copy`,
      },
      overrideAccess: true,
    })

    // The slug should be cleaned: spaces → hyphens, " - Copy" → stripped
    expect(updatedLesson.slug).toBeDefined()
    const slug = updatedLesson.slug as string
    expect(slug).not.toContain(' ') // No spaces
    expect(slug.toLowerCase()).not.toContain('copy') // No copy text
  })
})

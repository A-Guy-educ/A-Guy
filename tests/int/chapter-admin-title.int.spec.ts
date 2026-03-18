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

describe('Chapter adminTitle', () => {
  let payload: Payload
  let categoryId: string
  let course1Id: string
  let course2Id: string
  let chapter1Id: string
  let chapter2Id: string
  let tenantId: string
  let timestamp: string
  const createdIds: string[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)
    timestamp = Date.now().toString().slice(0, 6)

    // Create category (required for courses)
    const category = await payload.create({
      collection: 'categories',
      data: {
        title: `AdminTitle Category ${timestamp}`,
        slug: `admin-title-category-${timestamp}`,
        locale: 'he',
      },
    })
    categoryId = category.id
    createdIds.push(category.id)

    // Create first course
    const course1 = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `ATC1-${timestamp}`,
        title: `Math Course ${timestamp}`,
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
    course1Id = course1.id
    createdIds.push(course1.id)

    // Create second course
    const course2 = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `ATC2-${timestamp}`,
        title: `Science Course ${timestamp}`,
        locale: 'he',
        categories: [categoryId],
        order: 1,
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
    course2Id = course2.id
    createdIds.push(course2.id)

    // Create first chapter in course 1
    const chapter1 = await payload.create({
      collection: 'chapters',
      data: {
        title: 'Introduction',
        chapterLabel: 'I',
        course: course1Id,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
      },
    })
    chapter1Id = chapter1.id
    createdIds.push(chapter1.id)

    // Create second chapter in course 2 (same title as chapter1)
    const chapter2 = await payload.create({
      collection: 'chapters',
      data: {
        title: 'Introduction',
        slug: `introduction-${timestamp}-2`, // Explicit slug to avoid uniqueness conflict
        chapterLabel: 'I',
        course: course2Id,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
      },
    })
    chapter2Id = chapter2.id
    createdIds.push(chapter2.id)
  })

  afterAll(async () => {
    // Cleanup in reverse order
    for (const id of createdIds.reverse()) {
      try {
        // Try to delete from each collection
        await payload.delete({ collection: 'chapters', id, overrideAccess: true })
      } catch {
        // Ignore if already deleted or not found
      }
      try {
        await payload.delete({ collection: 'courses', id, overrideAccess: true })
      } catch {
        // Ignore
      }
      try {
        await payload.delete({ collection: 'categories', id, overrideAccess: true })
      } catch {
        // Ignore
      }
      try {
        await payload.delete({ collection: 'tenants', id, overrideAccess: true })
      } catch {
        // Ignore
      }
    }
    await payload.db?.destroy?.()
  })

  it('creates chapter with adminTitle containing chapter and course title', async () => {
    const chapter = await payload.findByID({
      collection: 'chapters',
      id: chapter1Id,
      depth: 0,
    })

    expect(chapter.adminTitle).toBe(`Introduction — Math Course ${timestamp}`)
  })

  it('disambiguates chapters with same title but different courses', async () => {
    const chapter1 = await payload.findByID({
      collection: 'chapters',
      id: chapter1Id,
      depth: 0,
    })

    const chapter2 = await payload.findByID({
      collection: 'chapters',
      id: chapter2Id,
      depth: 0,
    })

    // They should have different adminTitles due to different courses
    expect(chapter1.adminTitle).not.toBe(chapter2.adminTitle)
    expect(chapter1.adminTitle).toContain('Math Course')
    expect(chapter2.adminTitle).toContain('Science Course')
  })

  it('cascades course title change to chapter adminTitle', async () => {
    // Update course title
    await payload.update({
      collection: 'courses',
      id: course1Id,
      data: {
        title: 'Advanced Math',
      },
    })

    // Re-fetch chapter
    const chapter = await payload.findByID({
      collection: 'chapters',
      id: chapter1Id,
      depth: 0,
    })

    // adminTitle should be updated with new course title
    expect(chapter.adminTitle).toContain('Advanced Math')
  })

  it('does not cascade when course title is unchanged', async () => {
    // This is a basic test to verify the hook doesn't cause errors
    // when updating non-title fields
    const course = await payload.update({
      collection: 'courses',
      id: course2Id,
      data: {
        description: 'Updated description',
      },
    })

    expect(course.description).toBe('Updated description')
  })

  it('chapter update recomputes adminTitle when title changes', async () => {
    const chapter = await payload.update({
      collection: 'chapters',
      id: chapter1Id,
      data: {
        title: 'Algebra Basics',
      },
    })

    expect(chapter.adminTitle).toContain('Algebra Basics')
  })

  it('chapter update recomputes adminTitle when course changes', async () => {
    // Move chapter from course1 to course2
    const chapter = await payload.update({
      collection: 'chapters',
      id: chapter1Id,
      data: {
        course: course2Id,
      },
    })

    // adminTitle should now reference Science Course
    expect(chapter.adminTitle).toContain('Science Course')
  })

  it('lesson data shape unchanged (NFR-001)', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Test Lesson',
        chapter: chapter1Id,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        accessType: 'inherit',
      },
      depth: 0, // Don't populate relationships
      draft: true,
    })

    // lesson.chapter should be a string ID (not an object)
    const chapterValue = lesson.chapter

    // Type assertion since the type system is getting confused
    createdIds.push(lesson.id)

    // Verify lesson stores chapter as an ID (not an object with new fields)
    expect(typeof chapterValue).toBe('string')
    expect(chapterValue).toBe(chapter1Id)

    // Clean up
    await payload.delete({ collection: 'lessons', id: lesson.id })
    createdIds.pop()
  })
})

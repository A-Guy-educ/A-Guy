/**
 * Integration tests for locale content filtering in course/chapter queries
 *
 * Regression test for production bug: courses without the `locale` field stored
 * in MongoDB were invisible when locale filtering was applied, because
 * `{ locale: { equals: 'he' } }` doesn't match documents where the field is absent.
 *
 * The fix uses `localeWhereClause()` which matches BOTH explicit locale values
 * AND documents where the locale field doesn't exist (pre-migration docs).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
const hasDatabaseUrl = !!process.env.DATABASE_URL

// IDs for cleanup
const createdCourses: string[] = []
const createdCategories: string[] = []

let categoryId: string

beforeAll(async () => {
  if (!hasDatabaseUrl) return
  payload = await getPayload({ config })

  // Shared category for all test courses
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: `Locale Filter Test Cat ${Date.now()}`,
      slug: `locale-filter-cat-${Date.now()}`,
      locale: 'he',
    },
  })
  categoryId = category.id
  createdCategories.push(category.id)
})

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  for (const id of createdCourses) {
    try {
      await payload.delete({ collection: 'courses', id, overrideAccess: true })
    } catch {
      /* ignore */
    }
  }
  for (const id of createdCategories) {
    try {
      await payload.delete({ collection: 'categories', id, overrideAccess: true })
    } catch {
      /* ignore */
    }
  }

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
})

describe.skipIf(!hasDatabaseUrl)('locale content filtering — courses', () => {
  it('should return courses WITH locale=he using localeWhereClause', async () => {
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `LF-1-${Date.now()}`,
        title: `Locale Filter With He ${Date.now()}`,
        slug: `lf-with-he-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
        categories: [categoryId],
        locale: 'he',
      } as any,
    })
    createdCourses.push(course.id)

    // Query using the fixed localeWhereClause pattern
    const result = await payload.find({
      collection: 'courses',
      where: {
        and: [
          { id: { equals: course.id } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
          { or: [{ locale: { equals: 'he' } }, { locale: { exists: false } }] },
        ],
      },
      overrideAccess: false,
    })

    expect(result.docs.length).toBe(1)
    expect(result.docs[0].id).toBe(course.id)
  })

  it('should return courses WITHOUT locale field (pre-migration docs)', async () => {
    // Create a course, then strip the locale field at MongoDB level
    // to simulate a pre-migration document
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `LF-2-${Date.now()}`,
        title: `Locale Filter No Field ${Date.now()}`,
        slug: `lf-no-field-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
        categories: [categoryId],
        locale: 'he',
      } as any,
    })
    createdCourses.push(course.id)

    // Remove the locale field directly in MongoDB to simulate pre-migration state
    const db = (payload.db as any).connection.db
    await db
      .collection('courses')
      .updateOne({ _id: new ObjectId(course.id) }, { $unset: { locale: '' } })

    // Verify the field is actually gone in MongoDB
    const rawDoc = await db
      .collection('courses')
      .findOne({ _id: new ObjectId(course.id) }, { projection: { locale: 1 } })
    expect(rawDoc.locale).toBeUndefined()

    // OLD query pattern (strict match) — misses documents without the field
    const strictResult = await payload.find({
      collection: 'courses',
      where: {
        and: [
          { id: { equals: course.id } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
          { locale: { equals: 'he' } },
        ],
      },
      overrideAccess: false,
    })
    expect(strictResult.docs.length).toBe(0) // Bug reproduced: course invisible

    // NEW query pattern (localeWhereClause) — finds the document
    const fixedResult = await payload.find({
      collection: 'courses',
      where: {
        and: [
          { id: { equals: course.id } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
          { or: [{ locale: { equals: 'he' } }, { locale: { exists: false } }] },
        ],
      },
      overrideAccess: false,
    })
    expect(fixedResult.docs.length).toBe(1)
    expect(fixedResult.docs[0].id).toBe(course.id)
  })

  it('should NOT return courses with a different locale', async () => {
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `LF-3-${Date.now()}`,
        title: `Locale Filter English ${Date.now()}`,
        slug: `lf-en-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
        categories: [categoryId],
        locale: 'en',
      } as any,
    })
    createdCourses.push(course.id)

    // Query for 'he' should NOT return an 'en' course
    const result = await payload.find({
      collection: 'courses',
      where: {
        and: [
          { id: { equals: course.id } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
          { or: [{ locale: { equals: 'he' } }, { locale: { exists: false } }] },
        ],
      },
      overrideAccess: false,
    })

    expect(result.docs.length).toBe(0)
  })
})

describe.skipIf(!hasDatabaseUrl)('locale content filtering — chapters by grade', () => {
  it('should find course without locale field when querying by grade', async () => {
    const ts = Date.now()
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `LFG-${ts}`,
        title: `Grade Filter Course ${ts}`,
        slug: `lfg-course-${ts}`,
        order: 0,
        status: 'published',
        isActive: true,
        categories: [categoryId],
        locale: 'he',
      } as any,
    })
    createdCourses.push(course.id)

    // Strip locale from MongoDB to simulate pre-migration document
    const db = (payload.db as any).connection.db
    await db
      .collection('courses')
      .updateOne({ _id: new ObjectId(course.id) }, { $unset: { locale: '' } })

    // Query by grade with locale (same pattern as queryChaptersByGrade)
    const courseResult = await payload.find({
      collection: 'courses',
      where: {
        and: [
          { courseLabel: { equals: `LFG-${ts}` } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
          { or: [{ locale: { equals: 'he' } }, { locale: { exists: false } }] },
        ],
      },
      limit: 1,
      pagination: false,
      overrideAccess: false,
    })

    expect(courseResult.docs.length).toBe(1)
    expect(courseResult.docs[0].id).toBe(course.id)
  })
})

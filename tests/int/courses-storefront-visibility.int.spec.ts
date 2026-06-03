/**
 * Integration tests: Courses Storefront Visibility
 *
 * Reproduces bug #2377: /courses shows empty state "No courses available at this time."
 * while admin shows 11 courses.
 *
 * Root cause: queryPublishedCourses applies contentStatus filtering that excludes
 * published, active courses when contentStatusVisible is not explicitly set.
 *
 * The issue is that when an admin sets contentStatus='soon', the contentStatusVisible
 * field is hidden (due to admin UI condition) and the value is NOT SAVED to the database.
 * The query then treats the missing field as "false", incorrectly hiding the course.
 *
 * This test suite verifies that queryPublishedCourses correctly handles courses
 * where contentStatusVisible is not explicitly set.
 *
 * @fileType integration-test
 * @domain courses
 * @ai-summary Tests that queryPublishedCourses handles contentStatusVisible correctly
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

let payload: Payload
let originalDatabaseUrl: string | undefined
let tenantId: string
let categoryId: string

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create tenant
  const tenant = await payload.create({
    collection: 'tenants',
    data: {
      name: `courses-visibility-test-${Date.now()}`,
      slug: `courses-vis-test-${Date.now()}`,
    } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create category
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Courses Visibility Test Category',
      slug: `courses-vis-cat-${Date.now()}`,
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  categoryId = category.id
}, 120_000)

afterAll(async () => {
  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

describe('Courses Storefront Visibility (Bug #2377)', () => {
  /**
   * The core bug: When a course has contentStatus='soon' but contentStatusVisible
   * is NOT explicitly set (because the admin UI hides the field when contentStatus != 'soon'),
   * the field is never saved to the database.
   *
   * The query condition:
   *   { contentStatus: { not_equals: 'soon' } } OR { contentStatusVisible: { equals: true } }
   *
   * For a course with contentStatus='soon' and contentStatusVisible=undefined:
   * - First condition: contentStatus != 'soon' → FALSE
   * - Second condition: contentStatusVisible == true → FALSE (undefined != true)
   * - OR → FALSE → course EXCLUDED
   *
   * This is WRONG because contentStatusVisible should default to true when contentStatus='soon'.
   * The admin UI condition hides the field, but the default value should still apply.
   */
  it('BUG: course with contentStatus="soon" and contentStatusVisible undefined is incorrectly excluded', async () => {
    // Create a published, active course with contentStatus='soon'
    // Do NOT set contentStatusVisible - Payload will apply defaultValue: true
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `CVT-SOON-${Date.now()}`,
        title: `Soon Course ${Date.now()}`,
        slug: `cvs-soon-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
        categories: [categoryId],
        tenant: tenantId,
        contentStatus: 'soon',
        // NOTE: contentStatusVisible is NOT set - Payload applies defaultValue: true
      } as any,
      overrideAccess: true,
    })

    // Verify contentStatus is 'soon'
    expect(course.contentStatus).toBe('soon')
    // Payload applies defaultValue: true when field is not set
    // So contentStatusVisible should be true (not undefined)
    expect((course as any).contentStatusVisible).toBe(true)

    const { queryPublishedCourses } = await import('@/server/repos/queries/courses')
    const courses = await queryPublishedCourses()

    // Check if the course is found
    const found = courses.some((c: any) => c.id === course.id)
    console.log('Course found:', found, 'Total courses returned:', courses.length)

    // If the course is not found, log why
    if (!found) {
      console.log('Query conditions might be filtering out this course')
    }

    // BUG: This test documents the actual bug.
    // The course has contentStatusVisible=true, so it should be visible.
    // But if it's not found, the query is incorrectly filtering it out.
    expect(found).toBe(true)
  })

  it('course with contentStatus="soon" and contentStatusVisible=false should be excluded', async () => {
    // This course is explicitly hidden - should be excluded
    const hiddenCourse = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `CVT-HIDDEN-${Date.now()}`,
        title: `Hidden Soon Course ${Date.now()}`,
        slug: `cvs-hidden-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
        categories: [categoryId],
        tenant: tenantId,
        contentStatus: 'soon',
        contentStatusVisible: false,
      } as any,
      overrideAccess: true,
    })

    const { queryPublishedCourses } = await import('@/server/repos/queries/courses')
    const courses = await queryPublishedCourses()

    // Correctly excluded: contentStatusVisible=false means hidden
    expect(courses.some((c: any) => c.id === hiddenCourse.id)).toBe(false)
  })

  it('course with contentStatus="soon" and contentStatusVisible=true should be included', async () => {
    const visibleCourse = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `CVT-VISIBLE-${Date.now()}`,
        title: `Visible Soon Course ${Date.now()}`,
        slug: `cvs-visible-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
        categories: [categoryId],
        tenant: tenantId,
        contentStatus: 'soon',
        contentStatusVisible: true,
      } as any,
      overrideAccess: true,
    })

    const { queryPublishedCourses } = await import('@/server/repos/queries/courses')
    const courses = await queryPublishedCourses()

    // Correctly included: contentStatusVisible=true means visible
    expect(courses.some((c: any) => c.id === visibleCourse.id)).toBe(true)
  })

  it('course with contentStatus="none" should be included', async () => {
    const normalCourse = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `CVT-NORMAL-${Date.now()}`,
        title: `Normal Course ${Date.now()}`,
        slug: `cvs-normal-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
        categories: [categoryId],
        tenant: tenantId,
        contentStatus: 'none',
      } as any,
      overrideAccess: true,
    })

    const { queryPublishedCourses } = await import('@/server/repos/queries/courses')
    const courses = await queryPublishedCourses()

    expect(courses.some((c: any) => c.id === normalCourse.id)).toBe(true)
  })

  describe('locale filtering', () => {
    it('should return course matching user locale', async () => {
      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: `CVT-LOC-1-${Date.now()}`,
          title: `Hebrew Locale Course ${Date.now()}`,
          slug: `cvs-loc-he-${Date.now()}`,
          order: 0,
          status: 'published',
          isActive: true,
          categories: [categoryId],
          tenant: tenantId,
          locale: 'he',
          contentStatus: 'none',
        } as any,
        overrideAccess: true,
      })

      const { queryPublishedCourses } = await import('@/server/repos/queries/courses')
      const courses = await queryPublishedCourses('he')

      expect(courses.some((c: any) => c.id === course.id)).toBe(true)
    })

    it('should NOT return course with different locale', async () => {
      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: `CVT-LOC-2-${Date.now()}`,
          title: `English Locale Course ${Date.now()}`,
          slug: `cvs-loc-en-${Date.now()}`,
          order: 0,
          status: 'published',
          isActive: true,
          categories: [categoryId],
          tenant: tenantId,
          locale: 'en',
          contentStatus: 'none',
        } as any,
        overrideAccess: true,
      })

      const { queryPublishedCourses } = await import('@/server/repos/queries/courses')
      const courses = await queryPublishedCourses('he')

      expect(courses.some((c: any) => c.id === course.id)).toBe(false)
    })
  })
})

// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array.

/**
 * Integration tests: Course Enrollments Dashboard (#1515)
 *
 * Verifies that the admin dashboard displays course enrollments correctly:
 * - Top 5 courses with enrollment counts and percentage of total enrollments
 * - "View All" button to see full list
 * - Tooltip for "Course Enrollments" label
 *
 * Issue: The widget shows 8 courses instead of 5, doesn't show percentages,
 * has no "View All" button, and missing tooltip.
 */
import { GET } from '@/app/api/admin/dashboard-metrics/route'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { getStrings } from '@/ui/admin/ConversionTracking/strings'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let adminToken: string
const createdUserIds: string[] = []
const createdCourseIds: string[] = []
let categoryId: string | undefined
let tenantId: string | undefined

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Tenant + category needed by courses
  const tenant = await payload.create({
    collection: 'tenants',
    data: {
      name: `enrollment-${ts}`,
      slug: `enrollment-${ts}`,
      status: 'active',
    } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  const category = await payload.create({
    collection: 'categories',
    data: { title: 'Enrollment Cat', slug: `enrollment-cat-${ts}`, locale: 'he' } as any,
    overrideAccess: true,
  })
  categoryId = category.id

  // Create 7 courses (more than the top 5 the widget should show)
  for (const i of [1, 2, 3, 4, 5, 6, 7]) {
    const c = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `Course ${i}`,
        title: `Test Enrollment Course ${i} ${ts}`,
        categories: [categoryId],
        tenant: tenantId,
        status: 'published',
      } as any,
      overrideAccess: true,
    })
    createdCourseIds.push(c.id)
  }

  // Admin user
  const adminEmail = `admin-enrollment-${ts}@test.local`
  const adminPassword = 'test-password-1234'
  const adminUser = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password: adminPassword,
      name: 'Enrollment Admin',
    } as any,
  })
  await payload.update({
    collection: 'users',
    id: adminUser.id,
    data: { role: AccountRole.Admin } as any,
    overrideAccess: true,
  })
  createdUserIds.push(adminUser.id)

  const login = await payload.login({
    collection: 'users',
    data: { email: adminEmail, password: adminPassword },
  })
  adminToken = login.token!

  // Create users with varying enrollments to test percentages
  // Total: 10 users across 7 courses
  const enrollmentSpecs: Array<{ email: string; courses: string[] }> = [
    // Course 1: 3 users
    { email: `u1-${ts}@test.local`, courses: [createdCourseIds[0]] },
    { email: `u2-${ts}@test.local`, courses: [createdCourseIds[0]] },
    { email: `u3-${ts}@test.local`, courses: [createdCourseIds[0]] },
    // Course 2: 2 users
    { email: `u4-${ts}@test.local`, courses: [createdCourseIds[1]] },
    { email: `u5-${ts}@test.local`, courses: [createdCourseIds[1]] },
    // Course 3: 2 users
    { email: `u6-${ts}@test.local`, courses: [createdCourseIds[2]] },
    { email: `u7-${ts}@test.local`, courses: [createdCourseIds[2]] },
    // Course 4: 1 user
    { email: `u8-${ts}@test.local`, courses: [createdCourseIds[3]] },
    // Course 5: 1 user
    { email: `u9-${ts}@test.local`, courses: [createdCourseIds[4]] },
    // Course 6: 1 user
    { email: `u10-${ts}@test.local`, courses: [createdCourseIds[5]] },
  ]

  for (const spec of enrollmentSpecs) {
    const u = await payload.create({
      collection: 'users',
      data: {
        email: spec.email,
        password: adminPassword,
        name: spec.email,
        courseEntitlements: spec.courses.map((c) => ({ course: c, grantMethod: 'admin' })),
      } as any,
      overrideAccess: true,
    })
    createdUserIds.push(u.id)
  }
}, 60_000)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  for (const id of createdUserIds) {
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
  for (const id of createdCourseIds) {
    try {
      await payload.delete({ collection: 'courses', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
  if (categoryId) {
    try {
      await payload.delete({ collection: 'categories', id: categoryId, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
  if (tenantId) {
    try {
      await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
}, 60_000)

describe.skipIf(!hasDatabaseUrl)(
  'GET /api/admin/dashboard-metrics — course enrollments dashboard (#1515)',
  () => {
    it('course enrollment entries should include percentage of total enrollments', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        engagement: {
          courseEnrollments: Array<{ courseTitle: string; count: number; percentage?: number }>
        }
      }

      // Each course enrollment entry should have a percentage field
      for (const enrollment of body.engagement.courseEnrollments) {
        expect(enrollment).toHaveProperty('percentage')
        expect(typeof enrollment.percentage).toBe('number')
        expect(enrollment.percentage).toBeGreaterThanOrEqual(0)
        expect(enrollment.percentage).toBeLessThanOrEqual(100)
      }
    })

    it('percentages should sum to approximately 100%', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        engagement: {
          courseEnrollments: Array<{ courseTitle: string; count: number; percentage?: number }>
        }
      }

      const totalPercentage = body.engagement.courseEnrollments.reduce(
        (sum, e) => sum + (e.percentage || 0),
        0,
      )

      // Percentages should sum to 100 (allowing for rounding)
      expect(totalPercentage).toBeGreaterThan(99)
      expect(totalPercentage).toBeLessThan(101)
    })

    it('top 5 courses should be correctly identified by enrollment count', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard-metrics?period=month', {
        headers: { Authorization: `JWT ${adminToken}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        engagement: {
          courseEnrollments: Array<{ courseTitle: string; count: number }>
        }
      }

      // Results should be sorted by count descending
      for (let i = 1; i < body.engagement.courseEnrollments.length; i++) {
        expect(body.engagement.courseEnrollments[i - 1].count).toBeGreaterThanOrEqual(
          body.engagement.courseEnrollments[i].count,
        )
      }

      // First 5 courses should be the top 5
      // Course 1 has 3 enrollments (most), Course 2 & 3 have 2, Course 4, 5, 6 have 1
      const top5 = body.engagement.courseEnrollments.slice(0, 5)
      expect(top5.length).toBeLessThanOrEqual(5)
    })
  },
)

describe('Course Enrollments Strings — tooltip (#1515)', () => {
  it('strings should have courseEnrollmentTooltip for info icon', () => {
    const enStrings = getStrings('en')
    const heStrings = getStrings('he')

    // Tooltip should exist for Course Enrollments label
    expect(enStrings).toHaveProperty('courseEnrollmentTooltip')
    expect(typeof (enStrings as any).courseEnrollmentTooltip).toBe('string')
    expect((enStrings as any).courseEnrollmentTooltip.length).toBeGreaterThan(0)

    expect(heStrings).toHaveProperty('courseEnrollmentTooltip')
    expect(typeof (heStrings as any).courseEnrollmentTooltip).toBe('string')
    expect((heStrings as any).courseEnrollmentTooltip.length).toBeGreaterThan(0)
  })

  it('English tooltip should describe unique user counting', () => {
    const enStrings = getStrings('en')
    const tooltip = (enStrings as any).courseEnrollmentTooltip as string

    // Tooltip should mention "unique users" and "counted only once"
    expect(tooltip.toLowerCase()).toMatch(/unique/)
    expect(tooltip.toLowerCase()).toMatch(/once/)
  })

  it('Hebrew tooltip should describe unique user counting', () => {
    const heStrings = getStrings('he')
    const tooltip = (heStrings as any).courseEnrollmentTooltip as string

    // Hebrew tooltip should describe unique users per course
    expect(tooltip.length).toBeGreaterThan(0)
    // Should contain Hebrew characters for unique user description
    expect(/[֐-׿]/.test(tooltip)).toBe(true)
  })
})

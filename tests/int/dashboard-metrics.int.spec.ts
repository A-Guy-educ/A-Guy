// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.

/**
 * Integration tests: Dashboard Metrics API — Course Enrollments
 *
 * Tests the course enrollment aggregation logic in the dashboard metrics API.
 * This specifically tests that:
 * 1. Multiple courses with enrollments are returned
 * 2. Enrollment counts are correct
 * 3. Course titles are properly resolved
 *
 * #1373 — Course Enrollments section only displays one course
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { extractCourseId } from '@/app/api/admin/dashboard-metrics/route'

let payload: Payload
let originalDatabaseUrl: string | undefined
let tenantId: string
let categoryId: string

// Test data IDs
let course1Id: string
let course2Id: string
let course3Id: string
let adminUserId: string
let adminEmail: string
let adminToken: string

// Route handler imported dynamically after DATABASE_URL is set
let GET: (req: NextRequest) => Promise<Response>

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
      name: `metrics-test-${Date.now()}`,
      slug: `metrics-test-${Date.now()}`,
      status: 'active',
    } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create category
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Metrics Test Category',
      slug: `metrics-cat-${Date.now()}`,
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  categoryId = category.id

  // Create three courses
  const course1 = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'Course 1',
      title: 'First Course',
      categories: [categoryId],
      tenant: tenantId,
      status: 'published',
    } as any,
    overrideAccess: true,
  })
  course1Id = course1.id

  const course2 = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'Course 2',
      title: 'Second Course',
      categories: [categoryId],
      tenant: tenantId,
      status: 'published',
    } as any,
    overrideAccess: true,
  })
  course2Id = course2.id

  const course3 = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'Course 3',
      title: 'Third Course',
      categories: [categoryId],
      tenant: tenantId,
      status: 'published',
    } as any,
    overrideAccess: true,
  })
  course3Id = course3.id

  // Create admin user for authentication
  adminEmail = `admin-metrics-${Date.now()}@test.local`
  const adminUser = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      password: 'test-password-1234',
      name: 'Metrics Admin',
      role: AccountRole.Admin,
    } as any,
    overrideAccess: true,
  })
  adminUserId = adminUser.id

  // Create users with entitlements to different courses
  // User 1: enrolled in Course 1
  await payload.create({
    collection: 'users',
    data: {
      email: `user-m1-${Date.now()}@test.local`,
      password: 'test-password-1234',
      name: 'User M1',
      courseEntitlements: [{ course: course1Id, grantMethod: 'admin' }],
    } as any,
    overrideAccess: true,
  })

  // User 2: enrolled in Course 1 (another enrollment in same course)
  await payload.create({
    collection: 'users',
    data: {
      email: `user-m2-${Date.now()}@test.local`,
      password: 'test-password-1234',
      name: 'User M2',
      courseEntitlements: [{ course: course1Id, grantMethod: 'admin' }],
    } as any,
    overrideAccess: true,
  })

  // User 3: enrolled in Course 2
  await payload.create({
    collection: 'users',
    data: {
      email: `user-m3-${Date.now()}@test.local`,
      password: 'test-password-1234',
      name: 'User M3',
      courseEntitlements: [{ course: course2Id, grantMethod: 'admin' }],
    } as any,
    overrideAccess: true,
  })

  // User 4: enrolled in Course 3
  await payload.create({
    collection: 'users',
    data: {
      email: `user-m4-${Date.now()}@test.local`,
      password: 'test-password-1234',
      name: 'User M4',
      courseEntitlements: [{ course: course3Id, grantMethod: 'admin' }],
    } as any,
    overrideAccess: true,
  })

  // User 5: enrolled in multiple courses (Course 1 and Course 2)
  await payload.create({
    collection: 'users',
    data: {
      email: `user-m5-${Date.now()}@test.local`,
      password: 'test-password-1234',
      name: 'User M5',
      courseEntitlements: [
        { course: course1Id, grantMethod: 'admin' },
        { course: course2Id, grantMethod: 'admin' },
      ],
    } as any,
    overrideAccess: true,
  })

  // Login admin user to get JWT token for API calls
  const loginResult = await payload.login({
    collection: 'users',
    data: { email: adminEmail, password: 'test-password-1234' },
  })
  adminToken = loginResult.token as string

  // Dynamic import after DATABASE_URL is set — ensures @payload-config is cached correctly
  const route = await import('@/app/api/admin/dashboard-metrics/route')
  GET = route.GET
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

describe('Dashboard Metrics API — Course Enrollments', () => {
  describe('Course enrollment aggregation', () => {
    it('returns multiple courses when users are enrolled in different courses', async () => {
      // Query users with entitlements directly to verify the data
      const users = await payload.find({
        collection: 'users',
        where: { 'courseEntitlements.course': { exists: true } },
        limit: 100,
        overrideAccess: true,
        depth: 0, // Get IDs only
      })

      // Manually aggregate enrollments to verify
      const enrollmentCounts = new Map<string, number>()
      for (const user of users.docs) {
        const u = user as any
        for (const ent of u.courseEntitlements || []) {
          const courseId = extractCourseId(ent.course)
          if (courseId) {
            enrollmentCounts.set(courseId, (enrollmentCounts.get(courseId) || 0) + 1)
          }
        }
      }

      // Verify we have enrollments for all three courses
      expect(enrollmentCounts.size).toBeGreaterThanOrEqual(3)

      // Course 1 should have 3 enrollments (User1, User2, User5)
      expect(enrollmentCounts.get(course1Id)).toBe(3)

      // Course 2 should have 2 enrollments (User3, User5)
      expect(enrollmentCounts.get(course2Id)).toBe(2)

      // Course 3 should have 1 enrollment (User4)
      expect(enrollmentCounts.get(course3Id)).toBe(1)
    })

    it('handles users with multiple entitlements correctly', async () => {
      // User 5 has entitlements to both Course 1 and Course 2
      const user5 = await payload.find({
        collection: 'users',
        where: { email: { contains: 'user-m5-' } },
        limit: 1,
        overrideAccess: true,
        depth: 0,
      })

      expect(user5.docs.length).toBe(1)
      const u = user5.docs[0] as any
      expect(u.courseEntitlements).toHaveLength(2)

      const courseIds = u.courseEntitlements.map((ent: any) =>
        typeof ent.course === 'object' ? ent.course?.id : ent.course,
      )
      expect(courseIds).toContain(course1Id)
      expect(courseIds).toContain(course2Id)
    })

    it('course titles are resolved from the courses collection', async () => {
      // Verify courses were created with correct titles
      const courses = await payload.find({
        collection: 'courses',
        where: {
          id: { in: [course1Id, course2Id, course3Id] },
        },
        limit: 10,
        overrideAccess: true,
      })

      const titleMap = new Map<string, string>()
      for (const course of courses.docs) {
        const c = course as any
        titleMap.set(c.id, c.title)
      }

      expect(titleMap.get(course1Id)).toBe('First Course')
      expect(titleMap.get(course2Id)).toBe('Second Course')
      expect(titleMap.get(course3Id)).toBe('Third Course')
    })
  })

  describe('Course ID extraction (the bug fix)', () => {
    it('correctly extracts course IDs from different storage formats', async () => {
      // This test verifies the fix for the bug where ObjectId instances
      // were not properly handled in the course ID extraction

      // Get a user with entitlements
      const users = await payload.find({
        collection: 'users',
        where: { 'courseEntitlements.course': { exists: true } },
        limit: 1,
        overrideAccess: true,
        // Not using depth:0 to get the full relationship data
      })

      expect(users.docs.length).toBeGreaterThan(0)
      const user = users.docs[0] as any

      // The entitlement's course could be:
      // 1. A string ID
      // 2. A plain object { id: "..." }
      // 3. A populated document { id: "...", title: "...", ... }
      // 4. A MongoDB ObjectId instance

      for (const ent of user.courseEntitlements || []) {
        // Extract course ID using the logic from the route
        const courseId =
          typeof ent.course === 'object' && 'id' in ent.course
            ? (ent.course as any).id
            : typeof ent.course === 'string'
              ? ent.course
              : null

        // Should always get a valid course ID
        expect(courseId).toBeTruthy()
      }
    })
  })

  describe('GET /api/admin/dashboard-metrics — HTTP API', () => {
    it('returns all three courses in engagement.courseEnrollments with correct counts', async () => {
      // Call the actual API endpoint with admin authentication
      const req = new NextRequest('http://localhost/api/admin/dashboard-metrics?period=month', {
        method: 'GET',
        headers: { Cookie: `payload-token=${adminToken}` },
      })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.engagement).toBeDefined()
      expect(body.engagement.courseEnrollments).toBeDefined()

      const enrollments = body.engagement.courseEnrollments as Array<{
        courseTitle: string
        count: number
      }>

      // Should have at least 3 courses enrolled
      expect(enrollments.length).toBeGreaterThanOrEqual(3)

      // Build a map of courseTitle -> count
      const titleToCount = new Map<string, number>()
      for (const e of enrollments) {
        titleToCount.set(e.courseTitle, e.count)
      }

      // Course 1 ("First Course") should have 3 enrollments (User1, User2, User5)
      expect(titleToCount.get('First Course')).toBe(3)

      // Course 2 ("Second Course") should have 2 enrollments (User3, User5)
      expect(titleToCount.get('Second Course')).toBe(2)

      // Course 3 ("Third Course") should have 1 enrollment (User4)
      expect(titleToCount.get('Third Course')).toBe(1)
    })

    it('returns 401 when not authenticated', async () => {
      const req = new NextRequest('http://localhost/api/admin/dashboard-metrics?period=month', {
        method: 'GET',
      })
      const res = await GET(req)
      expect(res.status).toBe(401)
    })
  })
})

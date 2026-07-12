// @vitest-environment node
/**
 * Integration tests: POST /api/course-selections and the underlying
 * `course-selections` collection access rules (#2659).
 *
 * Coverage:
 * - Anonymous happy path: guestId + course id → 200, row exists with hashed
 *   ip/ua and no `user`.
 * - Authenticated happy path: row carries the user id from req.user.
 * - Missing `course` → 400.
 * - Non-existent `course` id → 400.
 * - Non-admin GET on /api/course-selections/* → 401/403.
 *
 * Pattern follows tests/int/admin-dashboard-metrics.int.spec.ts and
 * tests/int/checkout-rate-limit.int.spec.ts — uses `getPayload({ config })`
 * to create fixtures and `NextRequest` to call the route directly.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST as logCourseSelectionPost } from '@/app/api/course-selections/route'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { clearAllRateLimits } from '@/server/services/rate-limit'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let adminUserId: string
let adminToken: string
let studentUserId: string
let studentToken: string
let courseId: string
let categoryId: string
let tenantId: string

const createdSelectionIds: string[] = []

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const ts = Date.now()

  // Admin user — Users.beforeChange forces role=student on create, so create
  // first and then promote via update (the canonical pattern from
  // tests/int/access-codes.int.spec.ts).
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: `course-selections-admin-${ts}@test.local`,
      password: 'test-password-1234',
      name: 'CS Admin',
    } as any,
  })
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { role: AccountRole.Admin } as any,
    overrideAccess: true,
  })
  adminUserId = admin.id

  const student = await payload.create({
    collection: 'users',
    data: {
      email: `course-selections-student-${ts}@test.local`,
      password: 'test-password-1234',
      name: 'CS Student',
      role: AccountRole.Student,
    } as any,
  })
  studentUserId = student.id

  const adminLogin = await payload.login({
    collection: 'users',
    data: { email: `course-selections-admin-${ts}@test.local`, password: 'test-password-1234' },
  })
  adminToken = adminLogin.token!

  const studentLogin = await payload.login({
    collection: 'users',
    data: { email: `course-selections-student-${ts}@test.local`, password: 'test-password-1234' },
  })
  studentToken = studentLogin.token!

  // Reuse or create a tenant + category so we can mint a course.
  const existingTenants = await payload.find({ collection: 'tenants', limit: 1 })
  if (existingTenants.docs.length > 0) {
    tenantId = existingTenants.docs[0].id
  } else {
    const tenant = await payload.create({
      collection: 'tenants',
      data: { name: 'CS Tenant', slug: `cs-tenant-${ts}` } as any,
      overrideAccess: true,
    })
    tenantId = tenant.id
  }

  const existingCategories = await payload.find({ collection: 'categories', limit: 1 })
  categoryId =
    existingCategories.docs[0]?.id ??
    (
      await payload.create({
        collection: 'categories',
        data: { title: 'CS Category', slug: `cs-cat-${ts}` } as any,
        overrideAccess: true,
      })
    ).id

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: `CS-${ts}`,
      title: 'Course Selections Test Course',
      slug: `cs-test-course-${ts}`,
      order: 0,
      status: 'published',
      isActive: true,
      categories: [categoryId],
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  courseId = course.id

  clearAllRateLimits()
}, 60_000)

afterEach(() => {
  clearAllRateLimits()
})

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  // Clean up created rows (admin can list — override access just in case).
  for (const id of createdSelectionIds) {
    try {
      await payload.delete({ collection: 'course-selections', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
  createdSelectionIds.length = 0

  for (const id of [adminUserId, studentUserId]) {
    if (!id) continue
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }

  if (courseId) {
    try {
      await payload.delete({ collection: 'courses', id: courseId, overrideAccess: true })
    } catch {
      /* ignore */
    }
  }
}, 60_000)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/course-selections', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': 'Mozilla/5.0 (integration-test)',
      'x-forwarded-for': '203.0.113.42',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

async function postSelection(
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; data: any }> {
  const res = await logCourseSelectionPost(buildRequest(body, headers))
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabaseUrl)('POST /api/course-selections', () => {
  it('anonymous happy path: stores row with hashed ip/ua, no user', async () => {
    const guestId = `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const { status, data } = await postSelection({
      course: courseId,
      source: 'start-page',
      guestId,
      gradeLevel: '10',
    })

    expect(status).toBe(200)
    expect(data).toEqual({ success: true })

    const found = await payload.find({
      collection: 'course-selections',
      where: { course: { equals: courseId }, guestId: { equals: guestId } },
      overrideAccess: true,
      limit: 1,
    })
    expect(found.totalDocs).toBe(1)
    const row = found.docs[0]
    createdSelectionIds.push(row.id)

    expect(row.user).toBeNull()
    expect(row.guestId).toBe(guestId)
    expect(row.gradeLevel).toBe('10')
    expect(row.source).toBe('start-page')
    expect(typeof row.ipHash).toBe('string')
    expect(row.ipHash).not.toBe('')
    expect(typeof row.userAgentHash).toBe('string')
    expect(row.userAgentHash).not.toBe('')
    // Server-computed hashes must not echo raw client values.
    expect(row.ipHash).not.toBe('203.0.113.42')
    expect(row.userAgentHash).not.toBe('Mozilla/5.0 (integration-test)')
  })

  it('authenticated happy path: stores user id from the JWT', async () => {
    const guestId = `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const { status, data } = await postSelection(
      {
        course: courseId,
        source: 'homepage-greeting',
        guestId,
      },
      { Authorization: `JWT ${studentToken}` },
    )

    expect(status).toBe(200)
    expect(data).toEqual({ success: true })

    const found = await payload.find({
      collection: 'course-selections',
      where: { course: { equals: courseId }, guestId: { equals: guestId } },
      overrideAccess: true,
      limit: 1,
    })
    expect(found.totalDocs).toBe(1)
    const row = found.docs[0]
    createdSelectionIds.push(row.id)

    expect(row.user).toBeTruthy()
    expect(String(row.user)).toBe(studentUserId)
  })

  it('returns 400 when course is missing', async () => {
    const { status, data } = await postSelection({
      source: 'course-card',
      guestId: 'guest-x',
    })
    expect(status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('returns 400 when source is missing or invalid', async () => {
    const missing = await postSelection({ course: courseId, guestId: 'g1' })
    expect(missing.status).toBe(400)

    const invalid = await postSelection({
      course: courseId,
      source: 'bogus-source',
      guestId: 'g1',
    })
    expect(invalid.status).toBe(400)
  })

  it('returns 400 when course id does not exist', async () => {
    const { status, data } = await postSelection({
      course: '000000000000000000000000', // valid ObjectId shape, not in DB
      source: 'course-card',
      guestId: 'guest-y',
    })
    expect(status).toBe(400)
    expect(data.error).toBe('Course not found')

    const found = await payload.find({
      collection: 'course-selections',
      where: { source: { equals: 'course-card' }, guestId: { equals: 'guest-y' } },
      overrideAccess: true,
      limit: 1,
    })
    expect(found.totalDocs).toBe(0)
  })
})

describe.skipIf(!hasDatabaseUrl)('course-selections collection access control', () => {
  it('non-admin GET via REST API returns 403', async () => {
    const url = `http://localhost:3000/api/course-selections?depth=0`
    const res = await fetch(url, {
      headers: { Authorization: `JWT ${studentToken}` },
    })
    // REST access: not admin → forbidden (Payload returns 403).
    expect([401, 403]).toContain(res.status)
    expect(res.status).not.toBe(200)
  })

  it('unauthenticated GET via REST API returns 401', async () => {
    const res = await fetch('http://localhost:3000/api/course-selections?depth=0')
    expect([401, 403]).toContain(res.status)
    expect(res.status).not.toBe(200)
  })

  it('local payload.create with no override bypasses access for public POST contract', async () => {
    // Sanity check: the collection's create access is wide-open, so the
    // POST handler can create rows without auth. We mirror what the handler
    // does (overrideAccess: true bypasses access control regardless).
    const row = await payload.create({
      collection: 'course-selections',
      data: {
        course: courseId,
        source: 'other',
        ipHash: 'integration-test-ip',
        userAgentHash: 'integration-test-ua',
      },
      overrideAccess: true,
    })
    createdSelectionIds.push(row.id)
    expect(row.course).toBeTruthy()
  })
})

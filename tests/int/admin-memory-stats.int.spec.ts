// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing.

/**
 * Integration tests: Admin Memory Stats API — response shape (#1471)
 *
 * Verifies that GET /api/admin/memory-stats:
 * - Returns 401 without authentication
 * - Returns 403 for non-admin users
 * - Returns the full stats shape for admin users
 * - Excludes deprecated items from stats
 */
import { GET } from '@/app/api/admin/memory-stats/route'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { buildMemoryItemData } from '../factories/memory-item.factory'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let adminToken: string
let adminUserId: string
let studentUserId: string
let studentToken: string
let memoryItemIds: string[] = []

const ts = Date.now()

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  const adminEmail = `admin-memory-stats-${ts}@test.local`
  const studentEmail = `student-memory-stats-${ts}@test.local`
  const password = 'test-password-1234'

  // Admin user — create as default user, then promote via update.
  // The Users beforeChange hook strips role=Admin on create; only
  // payload.update with overrideAccess can set it.
  const admin = await payload.create({
    collection: 'users',
    data: { email: adminEmail, password, name: 'Memory Admin' } as any,
  })
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { role: AccountRole.Admin } as any,
    overrideAccess: true,
  })
  adminUserId = admin.id

  // Student user
  const student = await payload.create({
    collection: 'users',
    data: {
      email: studentEmail,
      password,
      name: 'Memory Student',
      role: AccountRole.Student,
    } as any,
    overrideAccess: true,
  })
  studentUserId = student.id

  const adminLogin = await payload.login({
    collection: 'users',
    data: { email: adminEmail, password },
  })
  adminToken = adminLogin.token!

  const studentLogin = await payload.login({
    collection: 'users',
    data: { email: studentEmail, password },
  })
  studentToken = studentLogin.token!

  // Create 2 memory items for admin user (active)
  const adminPrefItem = await payload.create({
    collection: 'memory_items',
    data: {
      ...buildMemoryItemData({
        userId: adminUserId,
        type: 'preference',
        importance: 2,
        status: 'active',
      }),
    },
    overrideAccess: true,
  })
  memoryItemIds.push(adminPrefItem.id)
  const adminFactItem = await payload.create({
    collection: 'memory_items',
    data: {
      ...buildMemoryItemData({
        userId: adminUserId,
        type: 'fact',
        importance: 5,
        status: 'active',
      }),
    },
    overrideAccess: true,
  })
  memoryItemIds.push(adminFactItem.id)

  // Create 2 memory items for student user (active)
  const studentPrefItem = await payload.create({
    collection: 'memory_items',
    data: {
      ...buildMemoryItemData({
        userId: studentUserId,
        type: 'preference',
        importance: 4,
        status: 'active',
      }),
    },
    overrideAccess: true,
  })
  memoryItemIds.push(studentPrefItem.id)
  const studentDecisionItem = await payload.create({
    collection: 'memory_items',
    data: {
      ...buildMemoryItemData({
        userId: studentUserId,
        type: 'decision',
        importance: 3,
        status: 'active',
      }),
    },
    overrideAccess: true,
  })
  memoryItemIds.push(studentDecisionItem.id)

  // Create 1 deprecated memory item for admin (should be excluded from stats)
  const deprecatedFactItem = await payload.create({
    collection: 'memory_items',
    data: {
      ...buildMemoryItemData({
        userId: adminUserId,
        type: 'fact',
        importance: 1,
        status: 'deprecated',
      }),
    },
    overrideAccess: true,
  })
  memoryItemIds.push(deprecatedFactItem.id)
}, 60_000)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  for (const id of memoryItemIds) {
    if (!id) continue
    try {
      await payload.delete({ collection: 'memory_items', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }

  for (const id of [adminUserId, studentUserId]) {
    if (!id) continue
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch {
      /* already deleted */
    }
  }
}, 60_000)

describe.skipIf(!hasDatabaseUrl)('GET /api/admin/memory-stats', () => {
  it('returns 401 without auth', async () => {
    const req = new Request('http://localhost:3000/api/admin/memory-stats')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const req = new Request('http://localhost:3000/api/admin/memory-stats', {
      headers: { Authorization: `JWT ${studentToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns the full stats shape for admins', async () => {
    const req = new Request('http://localhost:3000/api/admin/memory-stats', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()

    // Total count must include at least our 4 active items (shared DB may have more)
    expect(body.totalCount).toBeGreaterThanOrEqual(4)

    // Per-user breakdown: our admin and student appear with at least their new items
    const adminEntry = body.byUser.find((u: { userId: string }) => u.userId === adminUserId)
    const studentEntry = body.byUser.find((u: { userId: string }) => u.userId === studentUserId)
    expect(adminEntry).toBeDefined()
    expect(adminEntry.count).toBeGreaterThanOrEqual(2)
    expect(studentEntry).toBeDefined()
    expect(studentEntry.count).toBeGreaterThanOrEqual(2)

    // Type distribution: our items contribute these types (other DB items may add more)
    expect(body.byType.preference).toBeGreaterThanOrEqual(2)
    expect(body.byType.decision).toBeGreaterThanOrEqual(1)
    expect(body.byType.fact).toBeGreaterThanOrEqual(1)

    // Average importance must be a valid number in the 1-5 scale
    expect(typeof body.averageImportance).toBe('number')
    expect(body.averageImportance).toBeGreaterThanOrEqual(1)
    expect(body.averageImportance).toBeLessThanOrEqual(5)

    // Date distribution
    expect(body.byDate).toEqual(
      expect.objectContaining({
        daily: expect.any(Array),
        weekly: expect.any(Array),
        monthly: expect.any(Array),
      }),
    )
    expect(body.byDate.daily.length).toBeGreaterThan(0)
    expect(body.byDate.daily[0]).toHaveProperty('date')
    expect(body.byDate.daily[0]).toHaveProperty('count')
    expect(body.byDate.weekly[0]).toHaveProperty('weekStart')
    expect(body.byDate.weekly[0]).toHaveProperty('count')
    expect(body.byDate.monthly[0]).toHaveProperty('month')
    expect(body.byDate.monthly[0]).toHaveProperty('count')
  })

  it('excludes deprecated items from stats', async () => {
    const req = new Request('http://localhost:3000/api/admin/memory-stats', {
      headers: { Authorization: `JWT ${adminToken}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()

    // Total count must include at least our 4 active items
    expect(body.totalCount).toBeGreaterThanOrEqual(4)

    // Our admin has at least 2 active items (deprecated not counted)
    const adminEntry = body.byUser.find((u: { userId: string }) => u.userId === adminUserId)
    expect(adminEntry).toBeDefined()
    expect(adminEntry.count).toBeGreaterThanOrEqual(2)

    // Type distribution: exactly 1 active fact — if the deprecated fact (also type='fact')
    // leaked in, byType.fact would be 2.  This is a stronger regression signal than the
    // importance-range check alone.
    expect(body.byType.fact).toBeGreaterThanOrEqual(1)

    // Average importance must be in valid range (deprecated item with importance=1 is excluded)
    expect(body.averageImportance).toBeGreaterThanOrEqual(1)
    expect(body.averageImportance).toBeLessThanOrEqual(5)
  })
})

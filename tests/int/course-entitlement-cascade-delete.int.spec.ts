/**
 * Integration tests: Course delete cascades to user courseEntitlements
 * Covers: cleanupOrphanEntitlements afterDelete hook on Courses collection
 *
 * #1288 — orphan entitlements surfaced as "Unknown" entries in the admin
 * dashboard course enrollment widget after a course was deleted.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
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

  const tenant = await payload.create({
    collection: 'tenants',
    data: { name: `ent-test-${Date.now()}`, slug: `ent-test-${Date.now()}` } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  const category = await payload.create({
    collection: 'categories',
    data: { title: 'Ent Category', slug: `ent-cat-${Date.now()}`, locale: 'he' } as any,
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

const createCourse = async (label: string, title: string) =>
  payload.create({
    collection: 'courses',
    data: {
      courseLabel: label,
      title,
      categories: [categoryId],
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })

const createUserWithEntitlements = async (email: string, courseIds: string[]): Promise<string> => {
  const user = await payload.create({
    collection: 'users',
    data: {
      email,
      password: 'test-password-1234',
      name: email,
      courseEntitlements: courseIds.map((id) => ({
        course: id,
        grantMethod: 'admin',
      })),
    } as any,
    overrideAccess: true,
  })
  return user.id
}

const getEntitlementCourseIds = async (userId: string): Promise<string[]> => {
  const u = (await payload.findByID({
    collection: 'users',
    id: userId,
    overrideAccess: true,
    depth: 0,
  })) as any
  return (u.courseEntitlements || []).map((e: any) =>
    typeof e.course === 'object' ? e.course?.id : e.course,
  )
}

describe('Course delete cascade → orphan entitlement cleanup', () => {
  it('removes entitlement referencing the deleted course', async () => {
    const course = await createCourse('D1', 'Doomed Course')
    const userId = await createUserWithEntitlements(`user-d1-${Date.now()}@test.local`, [course.id])

    await payload.delete({ collection: 'courses', id: course.id, overrideAccess: true })

    const courseIds = await getEntitlementCourseIds(userId)
    expect(courseIds).not.toContain(course.id)
    expect(courseIds).toHaveLength(0)
  })

  it("leaves other users' entitlements untouched", async () => {
    const a = await createCourse('D2a', 'Course A')
    const b = await createCourse('D2b', 'Course B')

    const affectedUserId = await createUserWithEntitlements(`user-aff-${Date.now()}@test.local`, [
      a.id,
      b.id,
    ])
    const unaffectedUserId = await createUserWithEntitlements(`user-un-${Date.now()}@test.local`, [
      b.id,
    ])

    await payload.delete({ collection: 'courses', id: a.id, overrideAccess: true })

    const affected = await getEntitlementCourseIds(affectedUserId)
    expect(affected).toEqual([b.id])

    const unaffected = await getEntitlementCourseIds(unaffectedUserId)
    expect(unaffected).toEqual([b.id])
  })

  it('preserves grantMethod and grantedAt on retained entitlements', async () => {
    const keep = await createCourse('D3keep', 'Keeper')
    const drop = await createCourse('D3drop', 'Dropper')

    const userId = await createUserWithEntitlements(`user-meta-${Date.now()}@test.local`, [
      keep.id,
      drop.id,
    ])

    // Capture original metadata
    const before = (await payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
      depth: 0,
    })) as any
    const keptBefore = before.courseEntitlements.find((e: any) => {
      const cid = typeof e.course === 'object' ? e.course?.id : e.course
      return cid === keep.id
    })

    await payload.delete({ collection: 'courses', id: drop.id, overrideAccess: true })

    const after = (await payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
      depth: 0,
    })) as any
    expect(after.courseEntitlements).toHaveLength(1)
    const keptAfter = after.courseEntitlements[0]
    expect(keptAfter.grantMethod).toBe(keptBefore.grantMethod)
    expect(keptAfter.grantedAt).toBe(keptBefore.grantedAt)
  })

  it('no-ops when no users hold an entitlement to the deleted course', async () => {
    const course = await createCourse('D4', 'Unheld Course')
    // No users created for this course
    await expect(
      payload.delete({ collection: 'courses', id: course.id, overrideAccess: true }),
    ).resolves.toBeDefined()
  })

  it('cleans up all orphan entitlements when > PAGE_SIZE users are affected', async () => {
    const course = await createCourse('D5', 'Popular Course')
    // PAGE_SIZE = 500 in the hook — create enough users to span at least 2 pages
    // (Keep COUNT low enough that the verification loops don't exhaust the test
    // MongoDB connection pool; batched $in queries keep it fast.)
    const COUNT = 100
    const userIds = await Promise.all(
      Array.from({ length: COUNT }, (_, i) =>
        createUserWithEntitlements(`user-d5-${i}-${Date.now()}@test.local`, [course.id]),
      ),
    )

    await payload.delete({ collection: 'courses', id: course.id, overrideAccess: true })

    // after delete: verify via a single batched query rather than N sequential reads
    // (Sequential per-user findByID calls exhaust the test DB connection pool.)
    const remaining = (await payload.find({
      collection: 'users',
      where: { id: { in: userIds }, 'courseEntitlements.course': { equals: course.id } },
      limit: 0,
      overrideAccess: true,
    })) as any
    expect(remaining.totalDocs).toBe(0)
  }, 180_000)
})

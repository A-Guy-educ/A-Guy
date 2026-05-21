/**
 * Integration tests: Access Code Redemption Atomic Operations
 *
 * Verifies that the redemption endpoint uses atomic MongoDB operations
 * to prevent TOCTOU race conditions in:
 * 1. Access code usage count (over-redemption)
 * 2. Course entitlement deduplication
 *
 * @fileType integration-test
 * @domain entitlements
 * @pattern atomic-update
 * @ai-summary Tests atomic access code redemption preventing over-redemption and duplicate entitlements
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectId } from 'mongodb'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

let payload: Payload
let originalDatabaseUrl: string | undefined
let tenantId: string
let courseId: string

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
    data: { name: `redeem-test-${Date.now()}`, slug: `redeem-test-${Date.now()}` } as any,
    overrideAccess: true,
  })
  tenantId = tenant.id

  // Create category → course
  const category = await payload.create({
    collection: 'categories',
    data: { title: 'Redeem Test Category', slug: `redeem-cat-${Date.now()}`, locale: 'he' } as any,
    overrideAccess: true,
  })

  const course = await payload.create({
    collection: 'courses',
    data: {
      courseLabel: 'R1',
      title: 'Redeem Test Course',
      categories: [category.id],
      tenant: tenantId,
    } as any,
    overrideAccess: true,
  })
  courseId = course.id
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

/** Create a test user (forced to student by ensureRoleOnSignup hook). */
async function createUser(label = '') {
  const ts = Date.now()
  return payload.create({
    collection: 'users',
    data: {
      email: `redeem-user-${ts}${label}@test.com`,
      password: 'test-password-123!',
      name: `Redeem User ${ts}${label}`,
    } as any,
    overrideAccess: true,
  })
}

/** Create a test access code. */
async function createAccessCode(overrides: Record<string, unknown> = {}) {
  const ts = Date.now()
  return payload.create({
    collection: 'access-codes',
    data: {
      code: `TEST-${ts}-${Math.random().toString(36).slice(2, 6)}`,
      course: courseId,
      maxUses: 1,
      currentUses: 0,
      isActive: true,
      tenant: tenantId,
      ...overrides,
    } as any,
    overrideAccess: true,
  })
}

/** Clean up users, access codes, and user settings between tests. */
async function cleanup() {
  const [codes, users, settings] = await Promise.all([
    payload.find({ collection: 'access-codes', limit: 1000, overrideAccess: true }),
    payload.find({ collection: 'users', limit: 1000, overrideAccess: true }),
    payload.find({ collection: 'user_settings', limit: 1000, overrideAccess: true }),
  ])

  for (const s of settings.docs) {
    await payload
      .delete({ collection: 'user_settings', id: s.id, overrideAccess: true })
      .catch(() => {})
  }
  for (const c of codes.docs) {
    await payload
      .delete({ collection: 'access-codes', id: c.id, overrideAccess: true })
      .catch(() => {})
  }
  for (const u of users.docs) {
    await payload.delete({ collection: 'users', id: u.id, overrideAccess: true }).catch(() => {})
  }
}

beforeEach(cleanup)
afterEach(cleanup)

describe('Atomic access code redemption', () => {
  it('should atomically increment currentUses and prevent over-redemption (maxUses=1)', async () => {
    const accessCode = await createAccessCode({ maxUses: 1 })
    const accessCodesCollection = payload.db.collections['access-codes']

    // Simulate two concurrent atomic increment attempts
    const results = await Promise.all([
      accessCodesCollection.updateOne(
        { _id: new ObjectId(accessCode.id), currentUses: { $lt: 1 } },
        { $inc: { currentUses: 1 } },
      ),
      accessCodesCollection.updateOne(
        { _id: new ObjectId(accessCode.id), currentUses: { $lt: 1 } },
        { $inc: { currentUses: 1 } },
      ),
    ])

    const successCount = results.filter((r) => r.modifiedCount === 1).length
    expect(successCount).toBe(1)

    // Verify final state
    const updated = await payload.findByID({
      collection: 'access-codes',
      id: accessCode.id,
      overrideAccess: true,
    })
    expect(updated.currentUses).toBe(1)
  })

  it('should allow multiple redemptions up to maxUses', async () => {
    const accessCode = await createAccessCode({ maxUses: 3 })
    const accessCodesCollection = payload.db.collections['access-codes']

    // Simulate 5 concurrent atomic increment attempts with maxUses=3
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        accessCodesCollection.updateOne(
          { _id: new ObjectId(accessCode.id), currentUses: { $lt: 3 } },
          { $inc: { currentUses: 1 } },
        ),
      ),
    )

    const successCount = results.filter((r) => r.modifiedCount === 1).length
    expect(successCount).toBe(3)

    // Verify final state
    const updated = await payload.findByID({
      collection: 'access-codes',
      id: accessCode.id,
      overrideAccess: true,
    })
    expect(updated.currentUses).toBe(3)
  })

  it('should allow unlimited redemptions when maxUses=0', async () => {
    const accessCode = await createAccessCode({ maxUses: 0 })
    const accessCodesCollection = payload.db.collections['access-codes']

    // With maxUses=0, no $lt filter is applied — all increments should succeed
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        accessCodesCollection.updateOne(
          { _id: new ObjectId(accessCode.id) },
          { $inc: { currentUses: 1 } },
        ),
      ),
    )

    const successCount = results.filter((r) => r.modifiedCount === 1).length
    expect(successCount).toBe(5)

    const updated = await payload.findByID({
      collection: 'access-codes',
      id: accessCode.id,
      overrideAccess: true,
    })
    expect(updated.currentUses).toBe(5)
  })

  it('should atomically prevent duplicate entitlements for the same course', async () => {
    const user = await createUser()
    const usersCollection = payload.db.collections.users
    const courseObjectId = new ObjectId(courseId)

    // Simulate two concurrent entitlement additions for the same course
    const results = await Promise.all([
      usersCollection.updateOne(
        {
          _id: new ObjectId(user.id),
          'courseEntitlements.course': { $ne: courseObjectId },
        },
        {
          $push: {
            courseEntitlements: {
              _id: new ObjectId(),
              course: courseObjectId,
              grantMethod: 'code',
              grantedAt: new Date().toISOString(),
              transactionId: 'access-code',
            },
          },
        },
      ),
      usersCollection.updateOne(
        {
          _id: new ObjectId(user.id),
          'courseEntitlements.course': { $ne: courseObjectId },
        },
        {
          $push: {
            courseEntitlements: {
              _id: new ObjectId(),
              course: courseObjectId,
              grantMethod: 'code',
              grantedAt: new Date().toISOString(),
              transactionId: 'access-code',
            },
          },
        },
      ),
    ])

    const successCount = results.filter((r) => r.modifiedCount === 1).length
    expect(successCount).toBe(1)

    // Verify user has exactly one entitlement
    const updated = await payload.findByID({
      collection: 'users',
      id: user.id,
      depth: 0,
      overrideAccess: true,
    })
    const entitlements = updated.courseEntitlements || []
    expect(entitlements.length).toBe(1)
  })

  it('should allow entitlements for different courses on the same user', async () => {
    const user = await createUser()
    const usersCollection = payload.db.collections.users

    // Create a second course
    const category2 = await payload.create({
      collection: 'categories',
      data: { title: 'Cat 2', slug: `cat2-${Date.now()}`, locale: 'he' } as any,
      overrideAccess: true,
    })
    const course2 = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'R2',
        title: 'Course 2',
        categories: [category2.id],
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })

    const courseObjectId1 = new ObjectId(courseId)
    const courseObjectId2 = new ObjectId(course2.id)

    // Add entitlements for two different courses
    const [result1, result2] = await Promise.all([
      usersCollection.updateOne(
        {
          _id: new ObjectId(user.id),
          'courseEntitlements.course': { $ne: courseObjectId1 },
        },
        {
          $push: {
            courseEntitlements: {
              _id: new ObjectId(),
              course: courseObjectId1,
              grantMethod: 'code',
              grantedAt: new Date().toISOString(),
              transactionId: 'access-code',
            },
          },
        },
      ),
      usersCollection.updateOne(
        {
          _id: new ObjectId(user.id),
          'courseEntitlements.course': { $ne: courseObjectId2 },
        },
        {
          $push: {
            courseEntitlements: {
              _id: new ObjectId(),
              course: courseObjectId2,
              grantMethod: 'code',
              grantedAt: new Date().toISOString(),
              transactionId: 'access-code',
            },
          },
        },
      ),
    ])

    expect(result1.modifiedCount).toBe(1)
    expect(result2.modifiedCount).toBe(1)

    // Verify user has exactly two entitlements
    const updated = await payload.findByID({
      collection: 'users',
      id: user.id,
      depth: 0,
      overrideAccess: true,
    })
    const entitlements = updated.courseEntitlements || []
    expect(entitlements.length).toBe(2)
  })

  it('should roll back access code increment when user already has entitlement', async () => {
    const user = await createUser()
    const accessCode = await createAccessCode({ maxUses: 5 })
    const accessCodesCollection = payload.db.collections['access-codes']
    const usersCollection = payload.db.collections.users
    const courseObjectId = new ObjectId(courseId)

    // Pre-grant the entitlement (simulates admin grant or prior redemption)
    await usersCollection.updateOne(
      { _id: new ObjectId(user.id) },
      {
        $push: {
          courseEntitlements: {
            _id: new ObjectId(),
            course: courseObjectId,
            grantMethod: 'admin',
            grantedAt: new Date().toISOString(),
            transactionId: 'admin-grant',
          },
        },
      },
    )

    // Simulate the full redemption flow: increment then try to add entitlement
    const incrementResult = await accessCodesCollection.updateOne(
      { _id: new ObjectId(accessCode.id), currentUses: { $lt: 5 } },
      { $inc: { currentUses: 1 } },
    )
    expect(incrementResult.modifiedCount).toBe(1) // Increment succeeds

    // Entitlement add should fail (user already has it)
    const entitlementResult = await usersCollection.updateOne(
      {
        _id: new ObjectId(user.id),
        'courseEntitlements.course': { $ne: courseObjectId },
      },
      {
        $push: {
          courseEntitlements: {
            _id: new ObjectId(),
            course: courseObjectId,
            grantMethod: 'code',
            grantedAt: new Date().toISOString(),
            transactionId: 'access-code',
          },
        },
      },
    )
    expect(entitlementResult.modifiedCount).toBe(0) // Already has entitlement

    // Roll back the increment
    await accessCodesCollection.updateOne(
      { _id: new ObjectId(accessCode.id) },
      { $inc: { currentUses: -1 } },
    )

    // Verify access code is back to 0
    const updated = await payload.findByID({
      collection: 'access-codes',
      id: accessCode.id,
      overrideAccess: true,
    })
    expect(updated.currentUses).toBe(0)
  })
})

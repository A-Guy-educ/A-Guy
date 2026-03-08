/**
 * Integration tests for UserProgress collection
 *
 * Tests:
 * - Create user progress record with overrideAccess
 * - Read back and verify fields
 * - Update progress data
 * - Access control: user can only read own progress
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AccountRole } from '@/server/payload/collections/Users/roles'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let testUser1Id: string
let testUser2Id: string
let testTenantId: string
let progressId: string

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Create test tenant
  const existingTenants = await payload.find({
    collection: 'tenants',
    limit: 1,
    overrideAccess: true,
  })

  if (existingTenants.docs.length > 0) {
    testTenantId = existingTenants.docs[0].id
  } else {
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: `Progress Test Tenant ${Date.now()}`,
        slug: `progress-test-${Date.now()}`,
      },
      overrideAccess: true,
    })
    testTenantId = tenant.id
  }

  // Create two test users
  const user1 = await payload.create({
    collection: 'users',
    data: {
      email: `progress-user1-${Date.now()}@example.com`,
      password: 'test123456',
      role: AccountRole.Student,
    },
  })
  testUser1Id = user1.id

  const user2 = await payload.create({
    collection: 'users',
    data: {
      email: `progress-user2-${Date.now()}@example.com`,
      password: 'test123456',
      role: AccountRole.Student,
    },
  })
  testUser2Id = user2.id
})

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  // Clean up progress records
  const records = await payload.find({
    collection: 'user-progress',
    where: {
      or: [{ user: { equals: testUser1Id } }, { user: { equals: testUser2Id } }],
    },
    limit: 1000,
    overrideAccess: true,
  })

  for (const record of records.docs) {
    await payload.delete({
      collection: 'user-progress',
      id: record.id,
      overrideAccess: true,
    })
  }

  // Clean up test users
  for (const userId of [testUser1Id, testUser2Id]) {
    if (userId) {
      await payload.delete({
        collection: 'users',
        id: userId,
        overrideAccess: true,
      })
    }
  }

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
})

describe.skipIf(!hasDatabaseUrl)('UserProgress Collection', () => {
  describe('CRUD operations', () => {
    it('should create a user progress record with overrideAccess', async () => {
      const progress = await payload.create({
        collection: 'user-progress',
        data: {
          user: testUser1Id,
          tenant: testTenantId,
          gradeLevel: '8',
          progressRecords: [
            {
              recordType: 'chapter',
              recordId: 'chapter-001',
              completionPercentage: 50,
              status: 'in_progress',
              lastAccessedAt: new Date().toISOString(),
            },
            {
              recordType: 'exercise',
              recordId: 'exercise-001',
              completionPercentage: 100,
              status: 'completed',
              score: 85,
              lastAccessedAt: new Date().toISOString(),
            },
          ],
        } as any,
        overrideAccess: true,
      })

      expect(progress).toBeDefined()
      expect(progress.id).toBeDefined()
      progressId = progress.id

      // Verify the user relationship
      const userId = typeof progress.user === 'string' ? progress.user : (progress.user as any)?.id
      expect(userId).toBe(testUser1Id)
    })

    it('should read back user progress and verify fields', async () => {
      const progress = await payload.findByID({
        collection: 'user-progress',
        id: progressId,
        overrideAccess: true,
      })

      expect(progress).toBeDefined()
      expect(progress.gradeLevel).toBe('8')

      const records = (progress as any).progressRecords
      expect(records).toBeDefined()
      expect(records).toHaveLength(2)

      // Verify chapter record
      const chapterRecord = records.find((r: any) => r.recordType === 'chapter')
      expect(chapterRecord).toBeDefined()
      expect(chapterRecord.recordId).toBe('chapter-001')
      expect(chapterRecord.completionPercentage).toBe(50)
      expect(chapterRecord.status).toBe('in_progress')

      // Verify exercise record
      const exerciseRecord = records.find((r: any) => r.recordType === 'exercise')
      expect(exerciseRecord).toBeDefined()
      expect(exerciseRecord.recordId).toBe('exercise-001')
      expect(exerciseRecord.completionPercentage).toBe(100)
      expect(exerciseRecord.status).toBe('completed')
      expect(exerciseRecord.score).toBe(85)
    })

    it('should update progress data', async () => {
      const updated = await payload.update({
        collection: 'user-progress',
        id: progressId,
        data: {
          gradeLevel: '9',
          progressRecords: [
            {
              recordType: 'chapter',
              recordId: 'chapter-001',
              completionPercentage: 100,
              status: 'completed',
              lastAccessedAt: new Date().toISOString(),
            },
          ],
        } as any,
        overrideAccess: true,
      })

      expect(updated.gradeLevel).toBe('9')

      const records = (updated as any).progressRecords
      expect(records).toHaveLength(1)
      expect(records[0].completionPercentage).toBe(100)
      expect(records[0].status).toBe('completed')
    })
  })

  describe('Access control', () => {
    let user2ProgressId: string

    it('should allow user to read their own progress', async () => {
      const user1 = await payload.findByID({
        collection: 'users',
        id: testUser1Id,
        overrideAccess: true,
      })

      const results = await payload.find({
        collection: 'user-progress',
        where: {
          user: { equals: testUser1Id },
        },
        user: user1 as any,
        overrideAccess: false,
      })

      expect(results.docs.length).toBeGreaterThanOrEqual(1)
      const found = results.docs.find((d) => d.id === progressId)
      expect(found).toBeDefined()
    })

    it("should prevent user from reading another user's progress", async () => {
      // Create progress for user 2
      const progress2 = await payload.create({
        collection: 'user-progress',
        data: {
          user: testUser2Id,
          tenant: testTenantId,
          gradeLevel: '10',
          progressRecords: [
            {
              recordType: 'lesson',
              recordId: 'lesson-999',
              completionPercentage: 30,
              status: 'in_progress',
            },
          ],
        } as any,
        overrideAccess: true,
      })
      user2ProgressId = progress2.id

      // User 1 tries to read user 2's progress
      const user1 = await payload.findByID({
        collection: 'users',
        id: testUser1Id,
        overrideAccess: true,
      })

      const results = await payload.find({
        collection: 'user-progress',
        user: user1 as any,
        overrideAccess: false,
      })

      // User 1 should NOT see user 2's progress
      const foundUser2Progress = results.docs.find((d) => d.id === user2ProgressId)
      expect(foundUser2Progress).toBeUndefined()
    })

    it('should allow admin to read all progress records', async () => {
      // Create admin user
      const admin = await payload.create({
        collection: 'users',
        data: {
          email: `progress-admin-${Date.now()}@example.com`,
          password: 'test123456',
          role: AccountRole.Admin,
        },
      })

      try {
        const adminUser = await payload.findByID({
          collection: 'users',
          id: admin.id,
          overrideAccess: true,
        })

        const results = await payload.find({
          collection: 'user-progress',
          where: {
            or: [{ user: { equals: testUser1Id } }, { user: { equals: testUser2Id } }],
          },
          user: adminUser as any,
          overrideAccess: false,
        })

        // Admin should see progress for both users
        const user1Progress = results.docs.find((d) => {
          const userId = typeof d.user === 'string' ? d.user : (d.user as any)?.id
          return userId === testUser1Id
        })
        const user2Progress = results.docs.find((d) => {
          const userId = typeof d.user === 'string' ? d.user : (d.user as any)?.id
          return userId === testUser2Id
        })

        expect(user1Progress).toBeDefined()
        expect(user2Progress).toBeDefined()
      } finally {
        await payload.delete({
          collection: 'users',
          id: admin.id,
          overrideAccess: true,
        })
      }
    })
  })
})

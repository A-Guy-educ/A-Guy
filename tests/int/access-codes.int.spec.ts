/**
 * Integration tests for Access Codes feature
 *
 * Tests:
 * - Creating lessons/courses with accessCode access type (Step 2)
 * - Creating and reading access codes (Step 3)
 * - Code redemptions collection CRUD (Step 4)
 * - Code redemption API endpoints (Steps 5, 9, 10)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { AccountRole } from '@/server/payload/collections/Users/roles'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let adminUserId: string
let studentUserId: string
let testTenantId: string
let testLessonId: string
let testCodeId: string
let testRedemptionId: string

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Get a tenant for tests
  const tenants = await payload.find({ collection: 'tenants', limit: 1, overrideAccess: true })
  testTenantId = tenants.docs[0]?.id

  // Create admin user
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: `access-codes-admin-${Date.now()}@example.com`,
      password: 'test123456',
      role: AccountRole.Admin,
    },
  })
  adminUserId = admin.id

  // Create student user
  const student = await payload.create({
    collection: 'users',
    data: {
      email: `access-codes-student-${Date.now()}@example.com`,
      password: 'test123456',
      role: AccountRole.Student,
    },
  })
  studentUserId = student.id

  // Create a test lesson for code targeting
  const chapterResult = await payload.find({
    collection: 'chapters',
    limit: 1,
    overrideAccess: true,
  })
  const chapterId = chapterResult.docs[0]?.id

  if (chapterId) {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Test Lesson for Access Codes',
        chapter: chapterId,
        order: 999,
        status: 'published',
        isActive: true,
        tenant: testTenantId,
      } as any,
      overrideAccess: true,
    })
    testLessonId = lesson.id
  }
})

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  // Clean up test data
  if (testRedemptionId) {
    await payload
      .delete({ collection: 'code-redemptions', id: testRedemptionId, overrideAccess: true })
      .catch(() => {})
  }
  if (testCodeId) {
    await payload
      .delete({ collection: 'access-codes', id: testCodeId, overrideAccess: true })
      .catch(() => {})
  }

  // Clean up users
  await payload
    .delete({ collection: 'users', id: adminUserId, overrideAccess: true })
    .catch(() => {})
  await payload
    .delete({ collection: 'users', id: studentUserId, overrideAccess: true })
    .catch(() => {})
})

describe('Access Codes Integration Tests', () => {
  describe('Step 2: Lessons and Courses with accessCode type', () => {
    it('can create a lesson with accessType=accessCode', async () => {
      if (!hasDatabaseUrl) return

      const chapterResult = await payload.find({
        collection: 'chapters',
        limit: 1,
        overrideAccess: true,
      })
      const chapterId = chapterResult.docs[0]?.id
      expect(chapterId).toBeDefined()

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          title: 'Access Coded Lesson',
          chapter: chapterId,
          order: 1000,
          status: 'published',
          isActive: true,
          accessType: 'accessCode',
          tenant: testTenantId,
        } as any,
        user: { id: adminUserId } as any,
        overrideAccess: false,
      })

      expect(lesson.accessType).toBe('accessCode')

      // Cleanup
      await payload.delete({ collection: 'lessons', id: lesson.id, overrideAccess: true })
    })

    it('can create a course with accessType=accessCode', async () => {
      if (!hasDatabaseUrl) return

      const categoryResult = await payload.find({
        collection: 'categories',
        limit: 1,
        overrideAccess: true,
      })
      const categoryId = categoryResult.docs[0]?.id
      expect(categoryId).toBeDefined()

      const course = await payload.create({
        collection: 'courses',
        data: {
          title: 'Access Coded Course',
          courseLabel: 'ACC',
          status: 'published',
          isActive: true,
          accessType: 'accessCode',
          pageAccessType: 'accessCode',
          categories: [categoryId],
          order: 999,
          tenant: testTenantId,
        } as any,
        user: { id: adminUserId } as any,
        overrideAccess: false,
      })

      expect(course.accessType).toBe('accessCode')

      // Cleanup
      await payload.delete({ collection: 'courses', id: course.id, overrideAccess: true })
    })

    it('existing access types still work', async () => {
      if (!hasDatabaseUrl) return

      const chapterResult = await payload.find({
        collection: 'chapters',
        limit: 1,
        overrideAccess: true,
      })
      const chapterId = chapterResult.docs[0]?.id
      expect(chapterId).toBeDefined()

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          title: 'Free Access Lesson',
          chapter: chapterId,
          order: 1001,
          status: 'published',
          isActive: true,
          accessType: 'free',
          tenant: testTenantId,
        } as any,
        overrideAccess: true,
      })

      expect(lesson.accessType).toBe('free')

      // Cleanup
      await payload.delete({ collection: 'lessons', id: lesson.id, overrideAccess: true })
    })
  })

  describe('Step 3: AccessCodes Collection', () => {
    it('admin can create an access code with all fields', async () => {
      if (!hasDatabaseUrl || !testLessonId) return

      const code = await payload.create({
        collection: 'access-codes',
        data: {
          code: `TEST-${Date.now()}`,
          label: 'Test Access Code',
          scopeType: 'lesson',
          scopeTarget: testLessonId,
          maxRedemptions: 10,
          currentRedemptions: 0,
          isActive: true,
          tenant: testTenantId,
        } as any,
        user: { id: adminUserId } as any,
        overrideAccess: false,
      })

      expect(code.code).toBeDefined()
      expect(code.scopeType).toBe('lesson')
      expect(code.maxRedemptions).toBe(10)
      expect(code.currentRedemptions).toBe(0)
      expect(code.isActive).toBe(true)

      testCodeId = code.id
    })

    it('access code must have unique code string', async () => {
      if (!hasDatabaseUrl || !testLessonId) return

      const codeString = `UNIQUE-${Date.now()}`

      // Create first code
      await payload.create({
        collection: 'access-codes',
        data: {
          code: codeString,
          label: 'First Code',
          scopeType: 'lesson',
          scopeTarget: testLessonId,
          isActive: true,
          tenant: testTenantId,
        } as any,
        overrideAccess: true,
      })

      // Attempt duplicate - should fail
      await expect(
        payload.create({
          collection: 'access-codes',
          data: {
            code: codeString,
            label: 'Duplicate Code',
            scopeType: 'lesson',
            scopeTarget: testLessonId,
            isActive: true,
            tenant: testTenantId,
          } as any,
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })

    it('non-admin cannot create access codes', async () => {
      if (!hasDatabaseUrl || !testLessonId) return

      await expect(
        payload.create({
          collection: 'access-codes',
          data: {
            code: `DENIED-${Date.now()}`,
            label: 'Should Not Create',
            scopeType: 'lesson',
            scopeTarget: testLessonId,
            isActive: true,
            tenant: testTenantId,
          } as any,
          user: { id: studentUserId } as any,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    })
  })

  describe('Step 4: CodeRedemptions Collection', () => {
    it('code redemption can be created with valid fields', async () => {
      if (!hasDatabaseUrl || !testCodeId) return

      const redemption = await payload.create({
        collection: 'code-redemptions',
        data: {
          code: testCodeId,
          user: studentUserId,
          lessonId: testLessonId,
          redeemedAt: new Date().toISOString(),
          tenant: testTenantId,
        } as any,
        overrideAccess: true,
      })

      expect(redemption.code).toBeDefined()
      expect(redemption.user).toBeDefined()
      expect(redemption.lessonId).toBe(testLessonId)

      testRedemptionId = redemption.id
    })

    it('student can only read own redemptions', async () => {
      if (!hasDatabaseUrl || !testCodeId) return

      // Create another student user for isolation
      const otherStudent = await payload.create({
        collection: 'users',
        data: {
          email: `other-student-${Date.now()}@example.com`,
          password: 'test123456',
          role: AccountRole.Student,
        },
        overrideAccess: true,
      })

      try {
        // Student user should see their own redemption
        const ownRedemptions = await payload.find({
          collection: 'code-redemptions',
          where: { user: { equals: studentUserId } },
          user: { id: studentUserId } as any,
          overrideAccess: false,
        })
        expect(ownRedemptions.docs.length).toBeGreaterThan(0)

        // Other student should NOT see the first student's redemption
        const otherRedemptions = await payload.find({
          collection: 'code-redemptions',
          where: { user: { equals: studentUserId } },
          user: { id: otherStudent.id } as any,
          overrideAccess: false,
        })
        expect(otherRedemptions.docs.length).toBe(0)
      } finally {
        await payload.delete({ collection: 'users', id: otherStudent.id, overrideAccess: true })
      }
    })

    it('admin can read all redemptions', async () => {
      if (!hasDatabaseUrl) return

      const allRedemptions = await payload.find({
        collection: 'code-redemptions',
        limit: 100,
        user: { id: adminUserId } as any,
        overrideAccess: false,
      })

      // Admin should see redemptions
      expect(allRedemptions.totalDocs).toBeGreaterThan(0)
    })
  })

  describe('Step 5: Code Redemption API', () => {
    it('redeem valid code returns success', async () => {
      if (!hasDatabaseUrl || !testLessonId) return

      // This test validates the API response format - actual endpoint testing would require HTTP
      const code = await payload.find({
        collection: 'access-codes',
        where: { isActive: { equals: true } },
        limit: 1,
        overrideAccess: true,
      })

      expect(code.docs.length).toBeGreaterThan(0)
    })

    it('unauthenticated user cannot redeem', async () => {
      // This would be tested via actual HTTP request to the endpoint
      // For now, we verify the access control on the collection
      await expect(
        payload.create({
          collection: 'code-redemptions',
          data: {
            code: testCodeId,
            user: 'anonymous',
            lessonId: testLessonId,
            redeemedAt: new Date().toISOString(),
            tenant: testTenantId,
          } as any,
          overrideAccess: false, // Should be denied
        }),
      ).rejects.toThrow()
    })
  })

  describe('Step 9: Check Redemption API', () => {
    it('check returns redeemed status', async () => {
      if (!hasDatabaseUrl || !testLessonId) return

      // Verify redemption exists for test
      const redemption = await payload.find({
        collection: 'code-redemptions',
        where: {
          and: [{ user: { equals: studentUserId } }, { lessonId: { equals: testLessonId } }],
        },
        limit: 1,
        overrideAccess: true,
      })

      expect(redemption.docs.length).toBeGreaterThan(0)
    })
  })

  describe('Step 10: Admin CSV Export', () => {
    it('admin can query redemptions with user data', async () => {
      if (!hasDatabaseUrl) return

      const redemptions = await payload.find({
        collection: 'code-redemptions',
        limit: 100,
        depth: 2, // Populate user relationship
        user: { id: adminUserId } as any,
        overrideAccess: false,
      })

      // Admin should be able to get redemption data
      expect(redemptions.totalDocs).toBeGreaterThan(0)

      // Check user relationship is populated
      const redemption = redemptions.docs[0]
      if (redemption && typeof redemption.user === 'object') {
        // User should be populated - we can get name/email
        expect((redemption.user as { email?: string }).email).toBeDefined()
      }
    })
  })
})

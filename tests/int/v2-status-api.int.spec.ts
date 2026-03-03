/**
 * Integration tests for V2 Status API Endpoint
 *
 * Tests:
 * - GET /api/exercises/convert/status?pipelineVersion=2 returns V2 jobs
 * - GET without pipelineVersion returns V1 jobs (backward compatible)
 * - Status API filters correctly by pipeline version
 * - V2 job output shape is rendered correctly
 *
 * PREREQUISITE: Must have DATABASE_URL set to a real MongoDB instance
 */

import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ObjectId } from 'mongodb'

let payload: Payload

// Skip tests if DATABASE_URL is not set
const hasDatabaseUrl = !!process.env.DATABASE_URL

// These tests require a running Next.js server - skip if not available
const hasServerUrl = !!process.env.SERVER_URL

// Get test admin secret from environment
const TEST_ADMIN_SECRET = process.env.TEST_ADMIN_SECRET || ''

describe.skipIf(!hasDatabaseUrl)('V2 Status API', () => {
  beforeAll(async () => {
    if (!hasDatabaseUrl) return

    // Initialize Payload
    payload = await getPayload({ config })
  }, 60000)

  afterAll(async () => {
    if (!hasDatabaseUrl || !payload) return

    if (payload.db?.destroy) {
      await payload.db.destroy()
    }
  })

  describe('GET /api/exercises/convert/status', () => {
    it.skipIf(!hasServerUrl)('should return 401 when no auth is provided', async () => {
      const response = await fetch(
        `${process.env.SERVER_URL || 'http://localhost:3000'}/api/exercises/convert/status?lessonId=test&pipelineVersion=2`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      )

      expect(response.status).toBe(401)
    })

    it('should return V2 jobs when pipelineVersion=2', async () => {
      if (!TEST_ADMIN_SECRET) {
        console.warn('Skipping test: TEST_ADMIN_SECRET not set')
        return
      }

      // Create test data
      const timestamp = Date.now()

      const tenant = await payload.create({
        collection: 'tenants',
        data: {
          name: `Test Tenant ${timestamp}`,
          slug: `test-tenant-status-${timestamp}`,
        } as any,
      })

      const category = await payload.create({
        collection: 'categories',
        data: {
          title: `Test Category ${timestamp}`,
          slug: `test-category-status-${timestamp}`,
          locale: 'he',
        },
      })

      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'Test',
          title: `Test Course Status ${timestamp}`,
          slug: `test-course-status-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
          categories: [category.id],
          tenant: tenant.id,
        } as any,
      })

      const chapter = await payload.create({
        collection: 'chapters',
        data: {
          course: course.id,
          title: `Test Chapter ${timestamp}`,
          slug: `test-chapter-status-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          chapter: chapter.id,
          title: `Test Lesson Status ${timestamp}`,
          slug: `test-lesson-status-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
          tenant: tenant.id,
        } as any,
      })

      const media = await payload.create({
        collection: 'media',
        data: {
          filename: `test-${timestamp}.pdf`,
          mimeType: 'application/pdf',
          tenant: tenant.id,
        } as any,
      })

      // Directly insert V2 and V1 jobs into the database
      const db = payload.db as any
      const jobsColl = db.connection?.collection?.('payload-jobs')

      const v2JobId = new ObjectId()
      const v1JobId = new ObjectId()

      await jobsColl.insertOne({
        _id: v2JobId,
        taskSlug: 'pdf_to_exercises_v2',
        processing: false,
        hasError: false,
        createdAt: new Date(),
        input: {
          ctx: {
            lessonId: lesson.id,
            sourceDocId: media.id,
            tenantId: tenant.id,
            pipelineVersion: 2,
            conversionMode: 'v2_crops',
          },
        },
        output: {
          pagesTotal: 5,
          pagesProcessed: 3,
          exercisesCreated: 12,
          errors: [],
          warnings: [],
        },
      })

      await jobsColl.insertOne({
        _id: v1JobId,
        taskSlug: 'pdf_to_exercises',
        processing: false,
        hasError: false,
        createdAt: new Date(),
        input: {
          ctx: {
            lessonId: lesson.id,
            sourceDocId: media.id,
            tenantId: tenant.id,
            pipelineVersion: 1,
          },
        },
        output: {
          exerciseIds: ['ex-1', 'ex-2'],
          segmentCount: 2,
        },
      })

      // Test V2 status endpoint
      const v2Response = await fetch(
        `http://localhost:3000/api/exercises/convert/status?lessonId=${lesson.id}&mediaId=${media.id}&pipelineVersion=2&limit=10`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_ADMIN_SECRET}`,
          },
        },
      )

      expect(v2Response.status).toBe(200)
      const v2Data = await v2Response.json()
      expect(v2Data.docs).toBeDefined()

      // V2 response should only contain V2 job
      const v2JobIds = v2Data.docs.map((doc: any) => doc.taskSlug)
      expect(v2JobIds).toContain('pdf_to_exercises_v2')
      expect(v2JobIds).not.toContain('pdf_to_exercises')

      // V2 output should have V2-specific fields
      const v2Job = v2Data.docs.find((doc: any) => doc.taskSlug === 'pdf_to_exercises_v2')
      expect(v2Job).toBeDefined()
      expect(v2Job.output.pagesTotal).toBe(5)
      expect(v2Job.output.pagesProcessed).toBe(3)
      expect(v2Job.output.exercisesCreated).toBe(12)

      // Clean up
      await jobsColl.deleteOne({ _id: v2JobId })
      await jobsColl.deleteOne({ _id: v1JobId })
      await payload.delete({ collection: 'lessons', id: lesson.id })
      await payload.delete({ collection: 'chapters', id: chapter.id })
      await payload.delete({ collection: 'courses', id: course.id })
      await payload.delete({ collection: 'media', id: media.id })
      await payload.delete({ collection: 'categories', id: category.id })
      await payload.delete({ collection: 'tenants', id: tenant.id })
    }, 60000)

    it('should return V1 jobs when pipelineVersion is omitted (backward compatible)', async () => {
      if (!TEST_ADMIN_SECRET) {
        console.warn('Skipping test: TEST_ADMIN_SECRET not set')
        return
      }

      // Create test data
      const timestamp = Date.now()

      const tenant = await payload.create({
        collection: 'tenants',
        data: {
          name: `Test Tenant ${timestamp}`,
          slug: `test-tenant-backward-${timestamp}`,
        } as any,
      })

      const category = await payload.create({
        collection: 'categories',
        data: {
          title: `Test Category ${timestamp}`,
          slug: `test-category-backward-${timestamp}`,
          locale: 'he',
        },
      })

      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'Test',
          title: `Test Course Backward ${timestamp}`,
          slug: `test-course-backward-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
          categories: [category.id],
          tenant: tenant.id,
        } as any,
      })

      const chapter = await payload.create({
        collection: 'chapters',
        data: {
          course: course.id,
          title: `Test Chapter ${timestamp}`,
          slug: `test-chapter-backward-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          chapter: chapter.id,
          title: `Test Lesson Backward ${timestamp}`,
          slug: `test-lesson-backward-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
          tenant: tenant.id,
        } as any,
      })

      const media = await payload.create({
        collection: 'media',
        data: {
          filename: `test-${timestamp}.pdf`,
          mimeType: 'application/pdf',
          tenant: tenant.id,
        } as any,
      })

      // Directly insert V1 job
      const db = payload.db as any
      const jobsColl = db.connection?.collection?.('payload-jobs')

      const v1JobId = new ObjectId()

      await jobsColl.insertOne({
        _id: v1JobId,
        taskSlug: 'pdf_to_exercises',
        processing: false,
        hasError: false,
        createdAt: new Date(),
        input: {
          ctx: {
            lessonId: lesson.id,
            sourceDocId: media.id,
            tenantId: tenant.id,
            pipelineVersion: 1,
          },
        },
        output: {
          exerciseIds: ['ex-1', 'ex-2'],
          segmentCount: 2,
        },
      })

      // Test without pipelineVersion (backward compatible)
      const response = await fetch(
        `http://localhost:3000/api/exercises/convert/status?lessonId=${lesson.id}&mediaId=${media.id}&limit=10`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_ADMIN_SECRET}`,
          },
        },
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.docs).toBeDefined()

      // Should return V1 job when no pipelineVersion specified
      const jobSlugs = data.docs.map((doc: any) => doc.taskSlug)
      expect(jobSlugs).toContain('pdf_to_exercises')

      // Clean up
      await jobsColl.deleteOne({ _id: v1JobId })
      await payload.delete({ collection: 'lessons', id: lesson.id })
      await payload.delete({ collection: 'chapters', id: chapter.id })
      await payload.delete({ collection: 'courses', id: course.id })
      await payload.delete({ collection: 'media', id: media.id })
      await payload.delete({ collection: 'categories', id: category.id })
      await payload.delete({ collection: 'tenants', id: tenant.id })
    }, 60000)

    it('should return empty array when no V2 jobs exist', async () => {
      if (!TEST_ADMIN_SECRET) {
        console.warn('Skipping test: TEST_ADMIN_SECRET not set')
        return
      }

      // Create test data
      const timestamp = Date.now()

      const tenant = await payload.create({
        collection: 'tenants',
        data: {
          name: `Test Tenant ${timestamp}`,
          slug: `test-tenant-empty-${timestamp}`,
        } as any,
      })

      const category = await payload.create({
        collection: 'categories',
        data: {
          title: `Test Category ${timestamp}`,
          slug: `test-category-empty-${timestamp}`,
          locale: 'he',
        },
      })

      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'Test',
          title: `Test Course Empty ${timestamp}`,
          slug: `test-course-empty-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
          categories: [category.id],
          tenant: tenant.id,
        } as any,
      })

      const chapter = await payload.create({
        collection: 'chapters',
        data: {
          course: course.id,
          title: `Test Chapter ${timestamp}`,
          slug: `test-chapter-empty-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          chapter: chapter.id,
          title: `Test Lesson Empty ${timestamp}`,
          slug: `test-lesson-empty-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
          tenant: tenant.id,
        } as any,
      })

      const media = await payload.create({
        collection: 'media',
        data: {
          filename: `test-${timestamp}.pdf`,
          mimeType: 'application/pdf',
          tenant: tenant.id,
        } as any,
      })

      // Test V2 status when no V2 jobs exist
      const response = await fetch(
        `http://localhost:3000/api/exercises/convert/status?lessonId=${lesson.id}&mediaId=${media.id}&pipelineVersion=2&limit=10`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_ADMIN_SECRET}`,
          },
        },
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.docs).toEqual([])

      // Clean up
      await payload.delete({ collection: 'lessons', id: lesson.id })
      await payload.delete({ collection: 'chapters', id: chapter.id })
      await payload.delete({ collection: 'courses', id: course.id })
      await payload.delete({ collection: 'media', id: media.id })
      await payload.delete({ collection: 'categories', id: category.id })
      await payload.delete({ collection: 'tenants', id: tenant.id })
    }, 60000)
  })
})

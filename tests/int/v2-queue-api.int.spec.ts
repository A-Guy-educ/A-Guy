/**
 * Integration tests for V2 Queue API Endpoint
 *
 * Tests:
 * - POST /api/exercises/convert/queue-v2 creates V2 job with correct task slug
 * - Endpoint rejects unauthorized requests with 401
 * - Endpoint validates lesson exists and media is attached
 * - Job has correct input context with pipelineVersion=2 and conversionMode=v2_crops
 *
 * PREREQUISITE: Must have DATABASE_URL set to a real MongoDB instance
 */

import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

// Skip tests if DATABASE_URL is not set
const hasDatabaseUrl = !!process.env.DATABASE_URL

// These tests require a running Next.js server - skip if not available
const hasServerUrl = !!process.env.SERVER_URL

// Get test admin secret from environment
const TEST_ADMIN_SECRET = process.env.TEST_ADMIN_SECRET || ''

describe.skipIf(!hasDatabaseUrl)('V2 Queue API', () => {
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

  describe('POST /api/exercises/convert/queue-v2', () => {
    it.skipIf(!hasServerUrl)('should return 401 when no auth is provided', async () => {
      const response = await fetch(
        `${process.env.SERVER_URL || 'http://localhost:3000'}/api/exercises/convert/queue-v2`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessonId: 'some-lesson-id',
            mediaId: 'some-media-id',
          }),
        },
      )

      // Should fail without auth
      expect(response.status).toBe(401)
    })

    it.skipIf(!hasServerUrl)('should return 401 with invalid Bearer token', async () => {
      const response = await fetch(
        `${process.env.SERVER_URL || 'http://localhost:3000'}/api/exercises/convert/queue-v2`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid-token',
          },
          body: JSON.stringify({
            lessonId: 'some-lesson-id',
            mediaId: 'some-media-id',
          }),
        },
      )

      // Should fail with invalid token
      expect(response.status).toBe(401)
    })

    it('should create V2 job with TEST_ADMIN_SECRET', async () => {
      if (!TEST_ADMIN_SECRET) {
        console.warn('Skipping test: TEST_ADMIN_SECRET not set')
        return
      }

      // Create required test data
      const timestamp = Date.now()

      // Create tenant first (required for exercises)
      const tenant = await payload.create({
        collection: 'tenants',
        data: {
          name: `Test Tenant ${timestamp}`,
          slug: `test-tenant-${timestamp}`,
        } as any,
      })

      // Create category
      const category = await payload.create({
        collection: 'categories',
        data: {
          title: `Test Category ${timestamp}`,
          slug: `test-category-${timestamp}`,
          locale: 'he',
        },
      })

      // Create course with tenant
      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'Test',
          title: `Test Course ${timestamp}`,
          slug: `test-course-v2-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
          categories: [category.id],
          tenant: tenant.id,
        } as any,
      })

      // Create chapter
      const chapter = await payload.create({
        collection: 'chapters',
        data: {
          course: course.id,
          title: `Test Chapter ${timestamp}`,
          slug: `test-chapter-v2-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })

      // Create lesson with tenant
      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          chapter: chapter.id,
          title: `Test Lesson V2 ${timestamp}`,
          slug: `test-lesson-v2-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
          tenant: tenant.id,
        } as any,
      })

      // Create media file
      const media = await payload.create({
        collection: 'media',
        data: {
          filename: `test-${timestamp}.pdf`,
          mimeType: 'application/pdf',
          tenant: tenant.id,
        } as any,
      })

      // Add media to lesson's contentFiles
      await payload.update({
        collection: 'lessons',
        id: lesson.id,
        data: {
          contentFiles: [{ id: media.id }],
        } as any,
      })

      // Test the V2 queue endpoint
      const response = await fetch('http://localhost:3000/api/exercises/convert/queue-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_ADMIN_SECRET}`,
        },
        body: JSON.stringify({
          lessonId: lesson.id,
          mediaId: media.id,
        }),
      })

      // Should succeed with valid test secret
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.jobId).toBeDefined()
      expect(data.message).toBe('V2 conversion job queued')

      // Verify job was created with correct task slug
      const db = payload.db as any
      const jobsColl = db.connection?.collection?.('payload-jobs')
      const jobDoc = await jobsColl.findOne({ _id: data.jobId })

      expect(jobDoc).toBeDefined()
      expect(jobDoc.taskSlug).toBe('pdf_to_exercises_v2')
      expect(jobDoc.input.ctx.pipelineVersion).toBe(2)
      expect(jobDoc.input.ctx.conversionMode).toBe('v2_crops')
      expect(jobDoc.input.ctx.lessonId).toBe(lesson.id)
      expect(jobDoc.input.ctx.sourceDocId).toBe(media.id)
      expect(jobDoc.input.ctx.tenantId).toBe(tenant.id)

      // Clean up
      await jobsColl.deleteOne({ _id: data.jobId })
      await payload.delete({ collection: 'lessons', id: lesson.id })
      await payload.delete({ collection: 'chapters', id: chapter.id })
      await payload.delete({ collection: 'courses', id: course.id })
      await payload.delete({ collection: 'media', id: media.id })
      await payload.delete({ collection: 'categories', id: category.id })
      await payload.delete({ collection: 'tenants', id: tenant.id })
    }, 60000)

    it('should return 400 when lessonId is missing', async () => {
      if (!TEST_ADMIN_SECRET) {
        console.warn('Skipping test: TEST_ADMIN_SECRET not set')
        return
      }

      const response = await fetch('http://localhost:3000/api/exercises/convert/queue-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_ADMIN_SECRET}`,
        },
        body: JSON.stringify({
          mediaId: 'some-media-id',
        }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 when mediaId is missing', async () => {
      if (!TEST_ADMIN_SECRET) {
        console.warn('Skipping test: TEST_ADMIN_SECRET not set')
        return
      }

      const response = await fetch('http://localhost:3000/api/exercises/convert/queue-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_ADMIN_SECRET}`,
        },
        body: JSON.stringify({
          lessonId: 'some-lesson-id',
        }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 404 when lesson does not exist', async () => {
      if (!TEST_ADMIN_SECRET) {
        console.warn('Skipping test: TEST_ADMIN_SECRET not set')
        return
      }

      const response = await fetch('http://localhost:3000/api/exercises/convert/queue-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_ADMIN_SECRET}`,
        },
        body: JSON.stringify({
          lessonId: 'nonexistent-lesson-id',
          mediaId: 'some-media-id',
        }),
      })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error.code).toBe('LESSON_NOT_FOUND')
    })

    it('should return 400 when media is not attached to lesson', async () => {
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
          slug: `test-tenant-detach-${timestamp}`,
        } as any,
      })

      const category = await payload.create({
        collection: 'categories',
        data: {
          title: `Test Category ${timestamp}`,
          slug: `test-category-detach-${timestamp}`,
          locale: 'he',
        },
      })

      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'Test',
          title: `Test Course ${timestamp}`,
          slug: `test-course-detach-${timestamp}`,
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
          slug: `test-chapter-detach-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          chapter: chapter.id,
          title: `Test Lesson Detach ${timestamp}`,
          slug: `test-lesson-detach-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
          tenant: tenant.id,
        } as any,
      })

      // Create separate media not attached to lesson
      const media = await payload.create({
        collection: 'media',
        data: {
          filename: `test-${timestamp}.pdf`,
          mimeType: 'application/pdf',
          tenant: tenant.id,
        } as any,
      })

      const response = await fetch('http://localhost:3000/api/exercises/convert/queue-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_ADMIN_SECRET}`,
        },
        body: JSON.stringify({
          lessonId: lesson.id,
          mediaId: media.id,
        }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error.code).toBe('MEDIA_NOT_ATTACHED')

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

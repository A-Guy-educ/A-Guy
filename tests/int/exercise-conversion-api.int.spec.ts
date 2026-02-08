/**
 * Integration tests for Exercise Conversion API endpoints
 *
 * Tests:
 * - /api/prompts/for-conversion returns prompts for authenticated admin
 * - /api/exercises/convert/queue queues conversion job for authenticated admin
 * - Endpoints reject unauthorized requests
 *
 * PREREQUISITE: Must have DATABASE_URL set to a real MongoDB instance
 * (testcontainers don't work with Payload jobs requiring replica sets)
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

describe.skipIf(!hasDatabaseUrl)('Exercise Conversion API', () => {
  beforeAll(async () => {
    if (!hasDatabaseUrl) return

    // Initialize Payload
    payload = await getPayload({ config })

    // Create test admin user for testing
    const timestamp = Date.now()
    const testEmail = `exercise-conversion-test-${timestamp}@example.com`

    // Create admin user (unused but creates test data for potential future use)
    await payload.create({
      collection: 'users',
      data: {
        email: testEmail,
        password: 'test-password-123',
        role: 'admin',
      },
    })

    // Generate auth token for the admin user
    // The API checks for admin role via user.role.includes('admin')
    // It also accepts TEST_ADMIN_SECRET Bearer token in test mode
  }, 60000)

  afterAll(async () => {
    if (!hasDatabaseUrl || !payload) return

    // Clean up any test data
    // Note: In a real test, we'd delete the test user and any created jobs

    if (payload.db?.destroy) {
      await payload.db.destroy()
    }
  })

  describe('POST /api/prompts/for-conversion', () => {
    it.skipIf(!hasServerUrl)('should return 401 when no auth is provided', async () => {
      const response = await fetch(
        `${process.env.SERVER_URL || 'http://localhost:3000'}/api/prompts/for-conversion`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId: 'some-lesson-id' }),
        },
      )

      // Should fail without auth
      expect(response.status).toBe(401)
    })

    it.skipIf(!hasServerUrl)('should return 401 with invalid Bearer token', async () => {
      const response = await fetch(
        `${process.env.SERVER_URL || 'http://localhost:3000'}/api/prompts/for-conversion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid-token',
          },
          body: JSON.stringify({ lessonId: 'some-lesson-id' }),
        },
      )

      // Should fail with invalid token
      expect(response.status).toBe(401)
    })

    it('should accept TEST_ADMIN_SECRET Bearer token in test mode', async () => {
      if (!TEST_ADMIN_SECRET) {
        console.warn('Skipping test: TEST_ADMIN_SECRET not set')
        return
      }

      // Create required test data first
      const timestamp = Date.now()

      // Create category
      const category = await payload.create({
        collection: 'categories',
        data: {
          title: `Test Category ${timestamp}`,
          slug: `test-category-${timestamp}`,
        },
      })

      // Create course with tenant
      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'Test',
          title: `Test Course ${timestamp}`,
          slug: `test-course-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
          categories: [category.id],
          tenant: 'default', // Use default tenant
        } as any,
      })

      // Create chapter
      const chapter = await payload.create({
        collection: 'chapters',
        data: {
          course: course.id,
          title: `Test Chapter ${timestamp}`,
          slug: `test-chapter-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })

      // Create lesson
      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          chapter: chapter.id,
          title: `Test Lesson ${timestamp}`,
          slug: `test-lesson-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })

      // Create extractor prompt
      const extractorPrompt = await payload.create({
        collection: 'prompts',
        data: {
          title: `Test Extractor ${timestamp}`,
          key: `extractor-${timestamp}`,
          template: 'Extract exercises from this text',
          type: 'system',
          usage: 'extractor',
          status: 'published',
          tenant: 'default',
        } as any,
      })

      // Now test the endpoint with TEST_ADMIN_SECRET
      const response = await fetch('http://localhost:3000/api/prompts/for-conversion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_ADMIN_SECRET}`,
        },
        body: JSON.stringify({ lessonId: lesson.id }),
      })

      // Should succeed with valid test secret
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.extractors).toBeDefined()
      expect(data.verifiers).toBeUndefined()

      // Clean up test prompts
      await payload.delete({ collection: 'prompts', id: extractorPrompt.id })
      await payload.delete({ collection: 'lessons', id: lesson.id })
      await payload.delete({ collection: 'chapters', id: chapter.id })
      await payload.delete({ collection: 'courses', id: course.id })
      await payload.delete({ collection: 'categories', id: category.id })
    }, 60000)
  })

  describe('POST /api/exercises/convert/queue', () => {
    it.skipIf(!hasServerUrl)('should return 401 when no auth is provided', async () => {
      const response = await fetch(
        `${process.env.SERVER_URL || 'http://localhost:3000'}/api/exercises/convert/queue`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessonId: 'some-lesson-id',
            mediaId: 'some-media-id',
            extractorPromptId: 'some-prompt-id',
          }),
        },
      )

      // Should fail without auth
      expect(response.status).toBe(401)
    })

    it('should accept TEST_ADMIN_SECRET Bearer token in test mode', async () => {
      if (!TEST_ADMIN_SECRET) {
        console.warn('Skipping test: TEST_ADMIN_SECRET not set')
        return
      }

      // Create required test data
      const timestamp = Date.now()

      // Create category
      const category = await payload.create({
        collection: 'categories',
        data: {
          title: `Test Category ${timestamp}`,
          slug: `test-category-${timestamp}`,
        },
      })

      // Create course with tenant
      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'Test',
          title: `Test Course ${timestamp}`,
          slug: `test-course-queue-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
          categories: [category.id],
          tenant: 'default',
        } as any,
      })

      // Create chapter
      const chapter = await payload.create({
        collection: 'chapters',
        data: {
          course: course.id,
          title: `Test Chapter ${timestamp}`,
          slug: `test-chapter-queue-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })

      // Create lesson
      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          chapter: chapter.id,
          title: `Test Lesson Queue ${timestamp}`,
          slug: `test-lesson-queue-${timestamp}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })

      // Create extractor prompt
      const extractorPrompt = await payload.create({
        collection: 'prompts',
        data: {
          title: `Test Extractor Queue ${timestamp}`,
          key: `extractor-queue-${timestamp}`,
          template: 'Extract exercises from this text',
          type: 'system',
          usage: 'extractor',
          status: 'published',
          tenant: 'default',
        } as any,
      })

      // Create media file
      const media = await payload.create({
        collection: 'media',
        data: {
          filename: `test-${timestamp}.pdf`,
          mimeType: 'application/pdf',
        } as any,
      })

      // Test the queue endpoint
      const response = await fetch('http://localhost:3000/api/exercises/convert/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_ADMIN_SECRET}`,
        },
        body: JSON.stringify({
          lessonId: lesson.id,
          mediaId: media.id,
          extractorPromptId: extractorPrompt.id,
        }),
      })

      // Should succeed with valid test secret
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.jobId).toBeDefined()
      expect(data.success).toBe(true)

      // Clean up test data
      await payload.delete({ collection: 'prompts', id: extractorPrompt.id })
      await payload.delete({ collection: 'media', id: media.id })
      await payload.delete({ collection: 'lessons', id: lesson.id })
      await payload.delete({ collection: 'chapters', id: chapter.id })
      await payload.delete({ collection: 'courses', id: course.id })
      await payload.delete({ collection: 'categories', id: category.id })
    }, 60000)
  })
})

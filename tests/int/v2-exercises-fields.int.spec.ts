/**
 * Integration Tests for V2 Exercise Fields
 *
 * Tests:
 * - Exercises can be created with pipelineVersion=2
 * - sourceBboxNormalized field accepts JSON object with x/y/width/height (0..1)
 * - sourcePageIndex field accepts 0-based page numbers
 * - Traceability metadata round-trips through create/find operations
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

describe.skipIf(!hasDatabaseUrl)('V2 Exercise Fields', () => {
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

  describe('Exercise creation with V2 fields', () => {
    it('should create exercise with pipelineVersion=2', async () => {
      // Create test tenant first
      const tenant = await payload.create({
        collection: 'tenants',
        data: {
          name: `Test Tenant ${Date.now()}`,
          slug: `test-tenant-v2-${Date.now()}`,
        } as any,
      })

      // Create category
      const category = await payload.create({
        collection: 'categories',
        data: {
          title: `Test Category V2 ${Date.now()}`,
          slug: `test-category-v2-${Date.now()}`,
        },
      })

      // Create course
      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'Test',
          title: `Test Course V2 ${Date.now()}`,
          slug: `test-course-v2-${Date.now()}`,
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
          title: `Test Chapter V2 ${Date.now()}`,
          slug: `test-chapter-v2-${Date.now()}`,
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
          title: `Test Lesson V2 ${Date.now()}`,
          slug: `test-lesson-v2-${Date.now()}`,
          order: 0,
          status: 'published',
          isActive: true,
          tenant: tenant.id,
        } as any,
      })

      // Create exercise with V2 fields
      const exercise = await payload.create({
        collection: 'exercises',
        data: {
          title: 'Exercise 1',
          lesson: lesson.id,
          tenant: tenant.id,
          origin: 'conversion',
          pipelineVersion: 2,
          sourcePageIndex: 0,
          sourceBboxNormalized: {
            x: 0.1,
            y: 0.2,
            width: 0.5,
            height: 0.3,
          },
          content: {
            blocks: [
              {
                id: 'test-block-1',
                type: 'rich_text',
                format: 'md-math-v1',
                value: '',
                mediaIds: [],
              },
            ],
          },
        } as any,
      })

      // Verify exercise was created with V2 fields
      expect(exercise.id).toBeDefined()
      expect(exercise.pipelineVersion).toBe(2)
      expect(exercise.sourcePageIndex).toBe(0)
      expect(exercise.sourceBboxNormalized).toEqual({
        x: 0.1,
        y: 0.2,
        width: 0.5,
        height: 0.3,
      })

      // Clean up
      await payload.delete({ collection: 'exercises', id: exercise.id })
      await payload.delete({ collection: 'lessons', id: lesson.id })
      await payload.delete({ collection: 'chapters', id: chapter.id })
      await payload.delete({ collection: 'courses', id: course.id })
      await payload.delete({ collection: 'categories', id: category.id })
      await payload.delete({ collection: 'tenants', id: tenant.id })
    })

    it('should query exercises by pipelineVersion', async () => {
      // Create test tenant
      const tenant = await payload.create({
        collection: 'tenants',
        data: {
          name: `Test Tenant Query ${Date.now()}`,
          slug: `test-tenant-query-${Date.now()}`,
        } as any,
      })

      // Create minimal hierarchy
      const category = await payload.create({
        collection: 'categories',
        data: {
          title: `Test Category Query ${Date.now()}`,
          slug: `test-category-query-${Date.now()}`,
        },
      })

      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'Test',
          title: `Test Course Query ${Date.now()}`,
          slug: `test-course-query-${Date.now()}`,
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
          title: `Test Chapter Query ${Date.now()}`,
          slug: `test-chapter-query-${Date.now()}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          chapter: chapter.id,
          title: `Test Lesson Query ${Date.now()}`,
          slug: `test-lesson-query-${Date.now()}`,
          order: 0,
          status: 'published',
          isActive: true,
          tenant: tenant.id,
        } as any,
      })

      // Create exercises with different pipeline versions
      const v1Exercise = await payload.create({
        collection: 'exercises',
        data: {
          title: 'V1 Exercise',
          lesson: lesson.id,
          tenant: tenant.id,
          origin: 'conversion',
          pipelineVersion: 1,
          content: { blocks: [] },
        } as any,
      })

      const v2Exercise = await payload.create({
        collection: 'exercises',
        data: {
          title: 'V2 Exercise',
          lesson: lesson.id,
          tenant: tenant.id,
          origin: 'conversion',
          pipelineVersion: 2,
          sourcePageIndex: 0,
          sourceBboxNormalized: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
          content: { blocks: [] },
        } as any,
      })

      // Query V2 exercises only
      const v2Exercises = await payload.find({
        collection: 'exercises',
        where: {
          pipelineVersion: { equals: 2 },
          lesson: { equals: lesson.id },
        },
      })

      expect(v2Exercises.docs.length).toBeGreaterThanOrEqual(1)
      const foundV2 = v2Exercises.docs.find((ex) => ex.id === v2Exercise.id)
      expect(foundV2).toBeDefined()
      expect(foundV2!.pipelineVersion).toBe(2)

      // Query V1 exercises only
      const v1Exercises = await payload.find({
        collection: 'exercises',
        where: {
          pipelineVersion: { equals: 1 },
          lesson: { equals: lesson.id },
        },
      })

      const foundV1 = v1Exercises.docs.find((ex) => ex.id === v1Exercise.id)
      expect(foundV1).toBeDefined()
      expect(foundV1!.pipelineVersion).toBe(1)

      // Clean up
      await payload.delete({ collection: 'exercises', id: v1Exercise.id })
      await payload.delete({ collection: 'exercises', id: v2Exercise.id })
      await payload.delete({ collection: 'lessons', id: lesson.id })
      await payload.delete({ collection: 'chapters', id: chapter.id })
      await payload.delete({ collection: 'courses', id: course.id })
      await payload.delete({ collection: 'categories', id: category.id })
      await payload.delete({ collection: 'tenants', id: tenant.id })
    })

    it('should update exercise V2 fields', async () => {
      // Create test data
      const tenant = await payload.create({
        collection: 'tenants',
        data: {
          name: `Test Tenant Update ${Date.now()}`,
          slug: `test-tenant-update-${Date.now()}`,
        } as any,
      })

      const category = await payload.create({
        collection: 'categories',
        data: {
          title: `Test Category Update ${Date.now()}`,
          slug: `test-category-update-${Date.now()}`,
        },
      })

      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'Test',
          title: `Test Course Update ${Date.now()}`,
          slug: `test-course-update-${Date.now()}`,
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
          title: `Test Chapter Update ${Date.now()}`,
          slug: `test-chapter-update-${Date.now()}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          chapter: chapter.id,
          title: `Test Lesson Update ${Date.now()}`,
          slug: `test-lesson-update-${Date.now()}`,
          order: 0,
          status: 'published',
          isActive: true,
          tenant: tenant.id,
        } as any,
      })

      // Create exercise with initial V2 fields
      const exercise = await payload.create({
        collection: 'exercises',
        data: {
          title: 'Exercise Update Test',
          lesson: lesson.id,
          tenant: tenant.id,
          origin: 'conversion',
          pipelineVersion: 2,
          sourcePageIndex: 0,
          sourceBboxNormalized: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
          content: { blocks: [] },
        } as any,
      })

      // Update V2 fields
      await payload.update({
        collection: 'exercises',
        id: exercise.id,
        data: {
          sourcePageIndex: 5,
          sourceBboxNormalized: { x: 0.5, y: 0.5, width: 0.2, height: 0.2 },
        } as any,
      })

      // Verify update
      const updatedExercise = await payload.findByID({
        collection: 'exercises',
        id: exercise.id,
      })

      expect(updatedExercise.sourcePageIndex).toBe(5)
      expect(updatedExercise.sourceBboxNormalized).toEqual({
        x: 0.5,
        y: 0.5,
        width: 0.2,
        height: 0.2,
      })

      // Clean up
      await payload.delete({ collection: 'exercises', id: exercise.id })
      await payload.delete({ collection: 'lessons', id: lesson.id })
      await payload.delete({ collection: 'chapters', id: chapter.id })
      await payload.delete({ collection: 'courses', id: course.id })
      await payload.delete({ collection: 'categories', id: category.id })
      await payload.delete({ collection: 'tenants', id: tenant.id })
    })

    it('should handle various sourceBboxNormalized values', async () => {
      // Create test data
      const tenant = await payload.create({
        collection: 'tenants',
        data: {
          name: `Test Tenant Bbox ${Date.now()}`,
          slug: `test-tenant-bbox-${Date.now()}`,
        } as any,
      })

      const category = await payload.create({
        collection: 'categories',
        data: {
          title: `Test Category Bbox ${Date.now()}`,
          slug: `test-category-bbox-${Date.now()}`,
        },
      })

      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'Test',
          title: `Test Course Bbox ${Date.now()}`,
          slug: `test-course-bbox-${Date.now()}`,
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
          title: `Test Chapter Bbox ${Date.now()}`,
          slug: `test-chapter-bbox-${Date.now()}`,
          order: 0,
          status: 'published',
          isActive: true,
        } as any,
      })

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          chapter: chapter.id,
          title: `Test Lesson Bbox ${Date.now()}`,
          slug: `test-lesson-bbox-${Date.now()}`,
          order: 0,
          status: 'published',
          isActive: true,
          tenant: tenant.id,
        } as any,
      })

      // Test edge case: bbox at boundaries
      const edgeExercise = await payload.create({
        collection: 'exercises',
        data: {
          title: 'Edge Bbox Exercise',
          lesson: lesson.id,
          tenant: tenant.id,
          origin: 'conversion',
          pipelineVersion: 2,
          sourcePageIndex: 0,
          sourceBboxNormalized: { x: 0, y: 0, width: 1, height: 1 },
          content: { blocks: [] },
        } as any,
      })

      expect(edgeExercise.sourceBboxNormalized).toEqual({ x: 0, y: 0, width: 1, height: 1 })

      // Test small bbox
      const smallExercise = await payload.create({
        collection: 'exercises',
        data: {
          title: 'Small Bbox Exercise',
          lesson: lesson.id,
          tenant: tenant.id,
          origin: 'conversion',
          pipelineVersion: 2,
          sourcePageIndex: 0,
          sourceBboxNormalized: { x: 0.5, y: 0.5, width: 0.01, height: 0.01 },
          content: { blocks: [] },
        } as any,
      })

      expect(smallExercise.sourceBboxNormalized).toEqual({
        x: 0.5,
        y: 0.5,
        width: 0.01,
        height: 0.01,
      })

      // Clean up
      await payload.delete({ collection: 'exercises', id: edgeExercise.id })
      await payload.delete({ collection: 'exercises', id: smallExercise.id })
      await payload.delete({ collection: 'lessons', id: lesson.id })
      await payload.delete({ collection: 'chapters', id: chapter.id })
      await payload.delete({ collection: 'courses', id: course.id })
      await payload.delete({ collection: 'categories', id: category.id })
      await payload.delete({ collection: 'tenants', id: tenant.id })
    })
  })
})

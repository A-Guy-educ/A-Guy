/**
 * Integration tests for V3 Conversion Pipeline
 *
 * Tests the full V3 pipeline using real Payload + MongoDB:
 * - extractSingle orchestrator (service-level)
 * - Prompt resolver
 * - Create exercise from preview
 * - Lesson page V3 exercise detection
 *
 * Run: pnpm exec vitest run tests/int/v3-conversion-pipeline.int.spec.ts --config ./vitest.config.mts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { ContentSchema } from '@/server/payload/collections/Exercises/schemas'
import { extractSingle } from '@/server/services/exercise-conversion/v3/extract-single'
import { resolveExtractorPrompt } from '@/server/services/exercise-conversion/v3/prompt-resolver'
import { rebuildFromMultiPartPreview } from '@/server/services/exercise-conversion/v3/transform'
import type { Payload } from 'payload'
import { getSharedPayload } from '../setup/shared-payload'

// Skip tests if DATABASE_URL is not set
const hasDatabaseUrl = !!process.env.DATABASE_URL

describe.skipIf(!hasDatabaseUrl)('V3 Conversion Pipeline', () => {
  let payload: Payload

  // Test entity IDs - will be set in beforeAll
  let tenantId: string
  let categoryId: string
  let courseId: string
  let chapterId: string
  let lessonId: string
  let promptId: string
  let mediaId: string

  // Track created entities for cleanup
  const createdExerciseIds: string[] = []
  const createdLogIds: string[] = []

  // Mock LLM response for extractSingle
  const mockExtractionResponse = vi.hoisted(() => ({
    success: true,
    data: {
      question: 'What is 2+2?',
      options: ['3', '4', '5', '6'],
      correctAnswer: 1,
      explanation: 'Basic addition: 2+2=4',
    },
    metadata: {
      model: 'test-model',
      processingTimeMs: 100,
      imageSizeBytes: 1024,
    },
  }))

  vi.mock('@/infra/llm/services/data-extractor-service', () => ({
    extractFromImage: vi.fn().mockResolvedValue(mockExtractionResponse),
    extractFromImageV3: vi.fn().mockResolvedValue({
      ...mockExtractionResponse,
      data: {
        ...mockExtractionResponse.data,
        diagramDescription: '**Diagram:** Right triangle $ABC$ where $AB = 5$ cm',
        diagramPosition: 'before_question',
      },
    }),
  }))

  vi.mock('@/server/services/pdf-fetcher', () => ({
    getPdfBufferFromBlob: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.0 test content', 'ascii')),
    normalizeToAbsoluteUrl: vi
      .fn()
      .mockImplementation((url: string) => Promise.resolve(`http://localhost:3000${url}`)),
  }))

  beforeAll(async () => {
    payload = await getSharedPayload()

    const timestamp = Date.now()

    // Step 1: Create test tenant (use 'default' like existing tests)
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: `Test Tenant ${timestamp}`,
        slug: `test-tenant-${timestamp}`,
        domain: `test-${timestamp}.example.com`,
      } as any,
    })
    tenantId = tenant.id

    // Step 2: Create test hierarchy: category → course → chapter → lesson
    const category = await payload.create({
      collection: 'categories',
      data: {
        title: `Test Category ${timestamp}`,
        slug: `test-category-${timestamp}`,
        tenant: tenantId,
      } as any,
    })
    categoryId = category.id

    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'Test',
        title: `Test Course ${timestamp}`,
        slug: `test-course-${timestamp}`,
        order: 0,
        status: 'published',
        isActive: true,
        categories: [categoryId],
        tenant: tenantId,
      } as any,
    })
    courseId = course.id

    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        course: courseId,
        title: `Test Chapter ${timestamp}`,
        slug: `test-chapter-${timestamp}`,
        order: 0,
        status: 'published',
        isActive: true,
      } as any,
    })
    chapterId = chapter.id

    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter: chapterId,
        title: `Test Lesson ${timestamp}`,
        slug: `test-lesson-${timestamp}`,
        order: 0,
        tenant: tenantId,
        contentFiles: [],
      } as any,
    })
    lessonId = lesson.id

    // Step 3: Create published extractor prompt
    const prompt = await payload.create({
      collection: 'prompts',
      data: {
        key: `extractor-v3-${timestamp}`,
        title: `Test Extractor Prompt ${timestamp}`,
        usage: 'extractor',
        status: 'published',
        tenant: tenantId,
        template: 'Extract question from image',
      } as any,
    })
    promptId = prompt.id

    // Step 4: Create media document (metadata only - file fetching is mocked)
    const media = await payload.create({
      collection: 'media',
      data: {
        filename: 'check-1-exe.pdf',
        mimeType: 'application/pdf',
        tenant: tenantId,
      } as any,
    })
    mediaId = media.id

    // Step 5: Update lesson to include the media file
    await payload.update({
      collection: 'lessons',
      id: lessonId,
      data: {
        contentFiles: [mediaId],
      },
    })
  }, 120000)

  // Cleanup after all tests
  afterAll(async () => {
    if (!payload || !hasDatabaseUrl) return

    // Delete created exercises
    for (const exerciseId of createdExerciseIds) {
      try {
        await payload.delete({
          collection: 'exercises',
          id: exerciseId,
        })
      } catch {
        // Ignore cleanup errors
      }
    }

    // Delete extraction logs
    for (const logId of createdLogIds) {
      try {
        await (payload as any).delete({
          collection: 'extraction-logs',
          id: logId,
        })
      } catch {
        // Ignore cleanup errors
      }
    }

    // Delete lesson, chapter, course, category, prompt, media in reverse dependency order
    try {
      await payload.delete({ collection: 'lessons', id: lessonId })
    } catch {
      /* ignore */
    }
    try {
      await payload.delete({ collection: 'chapters', id: chapterId })
    } catch {
      /* ignore */
    }
    try {
      await payload.delete({ collection: 'courses', id: courseId })
    } catch {
      /* ignore */
    }
    try {
      await payload.delete({ collection: 'categories', id: categoryId })
    } catch {
      /* ignore */
    }
    try {
      await payload.delete({ collection: 'prompts', id: promptId })
    } catch {
      /* ignore */
    }
    try {
      await payload.delete({ collection: 'media', id: mediaId })
    } catch {
      /* ignore */
    }
    try {
      await payload.delete({ collection: 'tenants', id: tenantId })
    } catch {
      /* ignore */
    }
  })

  describe('extractSingle orchestrator', () => {
    it('should extract exercise from attached media successfully', async () => {
      const result = await extractSingle(payload, {
        lessonId,
        mediaId,
      })

      expect(result.success).toBe(true)
      expect(result.preview).toBeDefined()
      expect(result.preview?.draft).toBeDefined()
      // New multi-part format: stem + subQuestions
      expect(result.preview?.draft.subQuestions).toBeDefined()
      expect(result.preview?.draft.subQuestions.length).toBeGreaterThan(0)
      expect(result.preview?.draft.subQuestions[0].prompt).toBe('What is 2+2?')
      expect(result.preview?.draft.subQuestions[0].options).toEqual(['3', '4', '5', '6'])
      expect(result.preview?.draft.subQuestions[0].correctAnswer).toBe(1)
      expect(result.extractionLogId).toBeDefined()

      // Store log ID for cleanup
      createdLogIds.push(result.extractionLogId)

      // Verify extraction log was created
      const log = await (payload as any).findByID({
        collection: 'extraction-logs',
        id: result.extractionLogId,
      })
      expect(log).toBeDefined()
      expect(log.status).toBe('success')
      expect(log.stage).toBe('extract')
      expect(log.pipelineVersion).toBe(3)
    })

    it('should fail when media is not attached to lesson', async () => {
      // Create separate media not in lesson.contentFiles
      const otherMedia = await payload.create({
        collection: 'media',
        data: {
          filename: 'other.pdf',
          mimeType: 'application/pdf',
          fileSize: 100,
          tenant: tenantId,
        } as any,
      })

      const result = await extractSingle(payload, {
        lessonId,
        mediaId: otherMedia.id,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not attached')

      // Cleanup
      await payload.delete({ collection: 'media', id: otherMedia.id })
    })

    it('should fail with unsupported mime type', async () => {
      // Create media with unsupported mime type
      const textMedia = await payload.create({
        collection: 'media',
        data: {
          filename: 'test.txt',
          mimeType: 'text/plain',
          fileSize: 100,
          tenant: tenantId,
        } as any,
      })

      // Attach to lesson so it passes the attachment check (checked before mime type)
      await payload.update({
        collection: 'lessons',
        id: lessonId,
        data: { contentFiles: [mediaId, textMedia.id] },
      })

      const result = await extractSingle(payload, {
        lessonId,
        mediaId: textMedia.id,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unsupported mime type')

      // Restore original contentFiles and cleanup
      await payload.update({
        collection: 'lessons',
        id: lessonId,
        data: { contentFiles: [mediaId] },
      })
      await payload.delete({ collection: 'media', id: textMedia.id })
    })

    it('should throw when lesson not found', async () => {
      // Payload's findByID throws NotFound (404) for non-existent IDs
      await expect(
        extractSingle(payload, {
          lessonId: '000000000000000000000000',
          mediaId,
        }),
      ).rejects.toThrow('Not Found')
    })
  })

  describe('create exercise from preview', () => {
    it('should create exercise with valid ContentSchema', async () => {
      // First extract
      const extractResult = await extractSingle(payload, {
        lessonId,
        mediaId,
      })

      expect(extractResult.success).toBe(true)
      expect(extractResult.preview).toBeDefined()
      createdLogIds.push(extractResult.extractionLogId)

      // Rebuild content from preview (new multi-part format)
      const preview = extractResult.preview!.draft
      const transformResult = rebuildFromMultiPartPreview({
        title: preview.title,
        stem: preview.stem,
        subQuestions: preview.subQuestions,
        diagramDescription: preview.diagramDescription,
        diagramPosition: preview.diagramPosition,
      })

      // Create exercise
      const exercise = await payload.create({
        collection: 'exercises',
        data: {
          title: transformResult.title,
          content: transformResult.content,
          lesson: lessonId,
          tenant: tenantId,
          pipelineVersion: 3,
          origin: 'conversion',
        } as any,
      })

      createdExerciseIds.push(exercise.id)

      // Verify exercise exists in DB
      const fetched = await payload.findByID({
        collection: 'exercises',
        id: exercise.id,
        depth: 0,
      })

      expect(fetched).toBeDefined()
      expect((fetched as any).pipelineVersion).toBe(3)
      expect((fetched as any).origin).toBe('conversion')

      // Validate content against ContentSchema
      const contentValidation = ContentSchema.safeParse((fetched as any).content)
      expect(contentValidation.success).toBe(true)

      // Create extraction log for create stage
      const createLogId = await (payload as any).create({
        collection: 'extraction-logs',
        data: {
          tenant: tenantId,
          lesson: lessonId,
          media: mediaId,
          prompt: promptId,
          status: 'success',
          stage: 'create',
          pipelineVersion: 3,
          processingTimeMs: 100,
          model: 'test-model',
        },
        overrideAccess: true,
      })
      createdLogIds.push(createLogId.id)

      // Verify create-stage extraction log exists
      const createLog = await (payload as any).findByID({
        collection: 'extraction-logs',
        id: createLogId.id,
      })
      expect(createLog).toBeDefined()
      expect(createLog.stage).toBe('create')
    })
  })

  describe('prompt resolver', () => {
    it('should resolve published extractor prompt for tenant', async () => {
      const resolved = await resolveExtractorPrompt(payload, tenantId)

      expect(resolved).toBeDefined()
      expect(resolved.prompt.id).toBe(promptId)
      expect(resolved.prompt.usage).toBe('extractor')
      expect(resolved.prompt.status).toBe('published')
    })

    it('should throw when prompt ID does not exist', async () => {
      // Payload's findByID throws NotFound (404) for non-existent IDs
      await expect(
        resolveExtractorPrompt(payload, tenantId, '000000000000000000000000'),
      ).rejects.toThrow('Not Found')
    })

    it('should throw when prompt is not published', async () => {
      // Create unpublished prompt
      const unpublishedPrompt = await payload.create({
        collection: 'prompts',
        data: {
          key: 'unpublished-test',
          title: 'Unpublished Test',
          usage: 'extractor',
          status: 'draft',
          tenant: tenantId,
          template: 'test',
        } as any,
      })

      await expect(resolveExtractorPrompt(payload, tenantId, unpublishedPrompt.id)).rejects.toThrow(
        'not published',
      )

      // Cleanup
      await payload.delete({ collection: 'prompts', id: unpublishedPrompt.id })
    })

    it('should throw when prompt does not belong to tenant', async () => {
      // Create another tenant with its own prompt
      const otherTenant = await payload.create({
        collection: 'tenants',
        data: {
          name: 'Other Tenant',
          slug: 'other-tenant',
          domain: 'other.example.com',
        } as any,
      })

      const otherPrompt = await payload.create({
        collection: 'prompts',
        data: {
          key: 'other-prompt',
          title: 'Other Prompt',
          usage: 'extractor',
          status: 'published',
          tenant: otherTenant.id,
          template: 'test',
        } as any,
      })

      await expect(resolveExtractorPrompt(payload, tenantId, otherPrompt.id)).rejects.toThrow(
        'belongs to different tenant',
      )

      // Cleanup
      await payload.delete({ collection: 'prompts', id: otherPrompt.id })
      await payload.delete({ collection: 'tenants', id: otherTenant.id })
    })
  })

  describe('lesson page V3 exercise detection', () => {
    it('should find exercises with pipelineVersion=3 for lesson', async () => {
      // Create an exercise with pipelineVersion=3 linked to test lesson
      const v3Exercise = await payload.create({
        collection: 'exercises',
        data: {
          title: 'V3 Converted Exercise',
          content: {
            blocks: [
              {
                id: 'test',
                type: 'question_select',
                variant: 'mcq',
                selectionMode: 'single',
                prompt: {
                  type: 'rich_text',
                  format: 'md-math-v1',
                  value: 'Test question',
                  mediaIds: [],
                },
                answer: {
                  multiSelect: false,
                  options: [
                    {
                      id: 'opt1',
                      content: {
                        type: 'rich_text',
                        format: 'md-math-v1',
                        value: 'A',
                        mediaIds: [],
                      },
                    },
                    {
                      id: 'opt2',
                      content: {
                        type: 'rich_text',
                        format: 'md-math-v1',
                        value: 'B',
                        mediaIds: [],
                      },
                    },
                  ],
                  correctOptionIds: ['opt1'],
                },
              },
            ],
          },
          lesson: lessonId,
          tenant: tenantId,
          pipelineVersion: 3,
          origin: 'conversion',
        } as any,
      })

      createdExerciseIds.push(v3Exercise.id)

      // Query exercises by lesson
      const result = await payload.find({
        collection: 'exercises',
        where: {
          lesson: { equals: lessonId },
        },
        depth: 0,
      })

      // Find V3 exercises
      const v3Exercises = result.docs.filter((doc: any) => doc.pipelineVersion === 3)

      expect(v3Exercises.length).toBeGreaterThan(0)
      expect(v3Exercises.some((e: any) => e.id === v3Exercise.id)).toBe(true)
    })
  })
})

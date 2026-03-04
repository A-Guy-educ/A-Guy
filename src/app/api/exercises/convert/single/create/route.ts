/**
 * V3 Create Exercise API Endpoint
 *
 * POST /api/exercises/convert/single/create
 *
 * Creates an exercise from edited preview data.
 * Validates extraction log preview gate before creating.
 *
 * @fileType api-route
 * @domain conversion
 * @pattern endpoint
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

import type { Lesson } from '@/payload-types'
import { withApiHandler } from '@/server/api/with-api-handler'
import { rebuildFromMultiPartPreview } from '@/server/services/exercise-conversion/v3/transform'

// Minimal type for extraction log (will be generated after types are created)
interface ExtractionLogMinimal {
  stage: string
  status: string
  lesson: string | { id: string } | null
  media: string | { id: string } | null
  prompt?: string
  promptVersion?: string
  model?: string
}

// Sub-question schema for multi-part exercises
const subQuestionSchema = z.object({
  prompt: z.string().min(1),
  type: z.enum(['free_response', 'mcq', 'true_false']).default('free_response'),
  options: z.array(z.string()).default([]),
  correctAnswer: z.number().nullable().default(null),
  acceptedAnswer: z.string().optional(),
})

// Request schema for multi-part exercises
const createRequestSchema = z.object({
  lessonId: z.string().min(1),
  mediaId: z.string().min(1),
  title: z.string().min(1),
  stem: z.string().optional(),
  subQuestions: z.array(subQuestionSchema).min(1),
  extractionLogId: z.string().min(1),
  diagramDescription: z.string().optional(),
  diagramPosition: z.enum(['before_question', 'after_question']).optional(),
})

type CreateRequest = z.infer<typeof createRequestSchema>

// POST handler
export const POST = withApiHandler<CreateRequest, unknown>(
  {
    auth: 'admin',
    bodySchema: createRequestSchema,
  },
  async ({ body, payload }) => {
    const {
      lessonId,
      mediaId,
      title,
      stem,
      subQuestions,
      extractionLogId,
      diagramDescription,
      diagramPosition,
    } = body

    // Step 1: Rebuild content from edited multi-part preview fields
    // rebuildFromMultiPartPreview → multiPartToExerciseContent already validates internally
    const { title: derivedTitle, content } = rebuildFromMultiPartPreview({
      title,
      stem,
      subQuestions,
      diagramDescription,
      diagramPosition,
    })

    // Use derived title if none provided
    const exerciseTitle = title || derivedTitle

    // Step 2: Fetch lesson to get tenant
    const lesson = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
    })

    if (!lesson) {
      return NextResponse.json(
        {
          success: false,
          error: 'Lesson not found',
        },
        { status: 404 },
      )
    }

    const typedLesson = lesson as unknown as Lesson
    const lessonTenantId =
      typeof typedLesson.tenant === 'object' ? typedLesson.tenant?.id : typedLesson.tenant
    if (!lessonTenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Lesson has no tenant',
        },
        { status: 400 },
      )
    }

    // Step 3: Fetch ExtractionLog and enforce preview gate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractionLog = await (payload as any).findByID({
      collection: 'extraction-logs',
      id: extractionLogId,
      depth: 0,
    })

    if (!extractionLog) {
      return NextResponse.json(
        {
          success: false,
          error: 'Extraction log not found',
        },
        { status: 404 },
      )
    }

    const typedLog = extractionLog as unknown as ExtractionLogMinimal

    // Enforce preview gate:
    // - must be extract stage
    // - must be success status
    // - must match lesson and media
    if (typedLog.stage !== 'extract') {
      return NextResponse.json(
        {
          success: false,
          error: 'Extraction log is not in extract stage',
        },
        { status: 400 },
      )
    }

    if (typedLog.status !== 'success') {
      return NextResponse.json(
        {
          success: false,
          error: 'Extraction was not successful',
        },
        { status: 400 },
      )
    }

    const logLessonId = typeof typedLog.lesson === 'object' ? typedLog.lesson?.id : typedLog.lesson
    const logMediaId = typeof typedLog.media === 'object' ? typedLog.media?.id : typedLog.media

    if (logLessonId !== lessonId || logMediaId !== mediaId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Extraction log does not match lesson or media',
        },
        { status: 400 },
      )
    }

    // Step 4: Create exercise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exercise = await (payload as any).create({
      collection: 'exercises',
      data: {
        title: exerciseTitle,
        content,
        lesson: lessonId,
        origin: 'conversion',
        sourceDoc: mediaId,
        pipelineVersion: 3,
        order: 0,
        tenant: lessonTenantId,
      },
      overrideAccess: true,
    })

    // Step 5: Create create-stage extraction log (append-only)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload as any).create({
      collection: 'extraction-logs',
      data: {
        tenant: lessonTenantId,
        lesson: lessonId,
        media: mediaId,
        exercise: exercise.id,
        prompt: typedLog.prompt,
        promptVersion: typedLog.promptVersion,
        status: 'success',
        stage: 'create',
        parsedPayload: content,
        pipelineVersion: 3,
        processingTimeMs: 0,
        model: typedLog.model || '',
      },
      overrideAccess: true,
    })

    // Return success with exercise ID and admin URL
    return NextResponse.json(
      {
        success: true,
        data: {
          exerciseId: exercise.id,
          adminUrl: `/admin/collections/exercises/${exercise.id}`,
        },
      },
      { status: 201 },
    )
  },
)

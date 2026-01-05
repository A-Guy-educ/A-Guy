/**
 * POST /api/ai/convert-lesson-image
 * One-click conversion: fetch lesson's contentFile image and convert to exercise
 *
 * Access: Authenticated users only
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { logger, createRequestLogger } from '@/utilities/logger'
import { generateExerciseFromImage } from '@/lib/ai/services/exercise-generator'
import * as Sentry from '@sentry/nextjs'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Media } from '@/payload-types'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  const requestId = randomUUID()
  const reqLogger = createRequestLogger(requestId)

  try {
    // Get authenticated user via Payload
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    // Check authentication
    if (!user) {
      reqLogger.warn('Unauthenticated request to convert-lesson-image')
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    // Parse request body
    const body = await request.json()
    const { lessonId } = body

    if (!lessonId) {
      reqLogger.warn('No lessonId provided')
      return NextResponse.json({ success: false, error: 'lessonId is required' }, { status: 400 })
    }

    reqLogger.info({ userId: user.id, lessonId }, 'Processing one-click conversion request')

    // Fetch lesson with contentFile
    const lesson = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 1,
    })

    if (!lesson) {
      reqLogger.warn({ lessonId }, 'Lesson not found')
      return NextResponse.json({ success: false, error: 'Lesson not found' }, { status: 404 })
    }

    // Check if contentFile exists and is populated
    const contentFile = lesson.contentFile as Media | null | undefined
    if (!contentFile || !contentFile.url) {
      reqLogger.warn({ lessonId }, 'Lesson has no contentFile')
      return NextResponse.json(
        { success: false, error: 'Lesson has no content file to convert' },
        { status: 400 },
      )
    }

    reqLogger.info({ lessonId, contentFileUrl: contentFile.url }, 'Fetching content file')

    // Read the image from filesystem (media files are stored in public/media)
    let imageBuffer: Buffer
    let mimeType: string

    try {
      // Extract filename from URL (e.g., /api/media/file/exercise.png -> exercise.png)
      const filename = contentFile.filename || path.basename(contentFile.url)
      const filePath = path.join(process.cwd(), 'public', 'media', filename)

      reqLogger.info({ lessonId, filePath }, 'Reading image from filesystem')

      // Read file from filesystem
      imageBuffer = fs.readFileSync(filePath)

      // Determine MIME type from file extension
      const ext = path.extname(filename).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
      }
      mimeType = mimeTypes[ext] || 'image/jpeg'
    } catch (readError) {
      reqLogger.error({ err: readError, lessonId }, 'Failed to read image file')
      return NextResponse.json(
        { success: false, error: 'Failed to read lesson content file from disk' },
        { status: 500 },
      )
    }

    reqLogger.info(
      {
        imageSize: imageBuffer.length,
        mimeType,
        lessonId,
      },
      'Calling AI service with lesson image',
    )

    // Call AI service (image only)
    const result = await generateExerciseFromImage({
      imageBuffer,
      mimeType,
    })

    if (!result.success) {
      reqLogger.warn({ error: result.error, lessonId }, 'AI service returned error')
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to process image',
          requestId,
        },
        { status: 500 },
      )
    }

    reqLogger.info(
      { processingTimeMs: result.metadata.processingTimeMs, lessonId },
      'Exercise generated successfully from lesson image',
    )

    // Auto-create exercise in database
    if (result.data) {
      try {
        // Determine question type based on whether we have options
        const hasOptions = result.data.options && result.data.options.length > 0
        const questionType = hasOptions ? 'mcq' : 'free_response'

        // Build answer spec based on question type
        let answerSpecJson
        if (hasOptions) {
          answerSpecJson = {
            questionType: 'mcq',
            multiSelect: false,
            options: result.data.options.map((opt: string, i: number) => ({
              id: `opt-${i + 1}`,
              content: [
                {
                  id: `opt-${i + 1}-text`,
                  type: 'rich_text',
                  format: 'md-math-v1',
                  value: opt,
                },
              ],
            })),
            correctOptionIds:
              result.data.correctAnswer !== null && result.data.correctAnswer !== undefined
                ? [`opt-${result.data.correctAnswer + 1}`]
                : ['opt-1'],
          }
        } else {
          answerSpecJson = {
            questionType: 'free_response',
            responseKind: 'text',
            acceptedAnswers: [result.data.explanation || 'See solution'],
          }
        }

        // Create exercise via Payload SDK directly (avoids fetch issues)
        const exerciseDoc = await payload.create({
          collection: 'exercises',
          data: {
            title: 'AI Generated Exercise',
            order: 0,
            lesson: lessonId,
            content: {
              blocks: [
                {
                  id: 'ai-generated-1',
                  type: 'rich_text',
                  format: 'md-math-v1',
                  value: result.data.question,
                  mediaIds: [],
                },
              ],
            },
            // @ts-expect-error - answerSpecJson is dynamic and doesn't match Exercise type exactly
            answerSpecJson,
          },
        })

        reqLogger.info(
          { exerciseId: exerciseDoc.id, lessonId },
          'Exercise created successfully from lesson image',
        )

        return NextResponse.json({
          success: true,
          data: result.data,
          metadata: result.metadata,
          exerciseId: exerciseDoc.id,
          requestId,
        })
      } catch (createError) {
        reqLogger.error({ err: createError, lessonId }, 'Failed to create exercise in database')
        // Still return AI result even if DB creation fails
        return NextResponse.json({
          success: true,
          data: result.data,
          metadata: result.metadata,
          error: 'AI conversion succeeded but exercise creation failed',
          requestId,
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      metadata: result.metadata,
      requestId,
    })
  } catch (error) {
    reqLogger.error({ err: error }, 'Error in convert-lesson-image endpoint')

    Sentry.captureException(error, {
      tags: { endpoint: '/api/ai/convert-lesson-image', requestId },
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process lesson image',
        requestId,
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'One-Click Lesson Image Converter',
    method: 'POST',
    documentation: {
      description: 'Automatically fetch lesson contentFile and convert to exercise',
      body: {
        lessonId: 'string - ID of the lesson to convert',
      },
      authentication: 'Required - must be logged in',
      response: {
        success: 'boolean',
        data: {
          question: 'string - extracted question text',
          options: 'string[] - answer options',
          correctAnswer: 'number - index of correct option',
          explanation: 'string (optional) - explanation if found',
        },
        metadata: {
          model: 'string - AI model used',
          processingTimeMs: 'number - processing time',
          imageSizeBytes: 'number - optimized image size',
        },
        exerciseId: 'string - ID of created exercise',
      },
    },
  })
}

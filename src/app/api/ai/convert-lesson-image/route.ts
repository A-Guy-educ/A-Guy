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

// Default prompt for Hebrew math exercises
const DEFAULT_PROMPT =
  'Extract this exercise completely with all parts (א, ב, ג, etc.). Convert all math symbols to LaTeX format ($x^2$, $\\frac{a}{b}$). Return as JSON with question, options (if any), correct answer index, and explanation.'

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

    // Fetch the image from the URL
    // Handle both absolute and relative URLs
    const imageUrl = contentFile.url.startsWith('http')
      ? contentFile.url
      : `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}${contentFile.url}`

    const imageResponse = await fetch(imageUrl)

    if (!imageResponse.ok) {
      reqLogger.warn({ lessonId, imageUrl, status: imageResponse.status }, 'Failed to fetch image')
      return NextResponse.json(
        { success: false, error: 'Failed to fetch lesson content file' },
        { status: 500 },
      )
    }

    // Get image buffer
    const arrayBuffer = await imageResponse.arrayBuffer()
    const imageBuffer = Buffer.from(arrayBuffer)

    // Determine MIME type from content type or file extension
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
    const mimeType = contentType.split(';')[0] // Remove charset if present

    reqLogger.info(
      {
        imageSize: imageBuffer.length,
        mimeType,
        lessonId,
      },
      'Calling AI service with lesson image',
    )

    // Call AI service
    const result = await generateExerciseFromImage({
      imageBuffer,
      mimeType,
      accompanyingText: DEFAULT_PROMPT,
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

        // Create exercise via REST API
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        const exerciseResponse = await fetch(`${baseUrl}/api/exercises`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            title: 'AI Generated Exercise',
            questionType,
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
            answerSpecJson,
          }),
        })

        if (!exerciseResponse.ok) {
          const errorData = await exerciseResponse.json()
          throw new Error(`Exercise creation failed: ${JSON.stringify(errorData)}`)
        }

        const exerciseDoc = await exerciseResponse.json()

        reqLogger.info(
          { exerciseId: exerciseDoc.doc?.id, lessonId },
          'Exercise created successfully from lesson image',
        )

        return NextResponse.json({
          success: true,
          data: result.data,
          metadata: result.metadata,
          exerciseId: exerciseDoc.doc?.id,
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

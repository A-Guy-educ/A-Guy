/**
 * POST /api/ai/image-to-exercise
 * Convert uploaded exercise image to structured JSON
 *
 * Access: All authenticated users
 * Future: Can be extended with rate limiting, usage tracking
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { logger, createRequestLogger } from '@/utilities/logger'
import { generateExerciseFromImage } from '@/lib/ai/services/exercise-generator'
import * as Sentry from '@sentry/nextjs'
import { getPayload } from 'payload'
import config from '@payload-config'

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export async function POST(request: NextRequest) {
  const requestId = randomUUID()
  const reqLogger = createRequestLogger(requestId)

  try {
    // Get authenticated user via Payload
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    // Check authentication
    if (!user) {
      reqLogger.warn('Unauthenticated request to image-to-exercise')
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    reqLogger.info({ userId: user.id }, 'Processing image-to-exercise request')

    // Parse multipart form data
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null
    const accompanyingText = formData.get('accompanyingText') as string | null

    // Validate file presence
    if (!imageFile) {
      reqLogger.warn('No image file provided')
      return NextResponse.json({ success: false, error: 'Image file is required' }, { status: 400 })
    }

    // Validate file size
    if (imageFile.size > MAX_FILE_SIZE) {
      reqLogger.warn({ fileSize: imageFile.size }, 'File size exceeds limit')
      return NextResponse.json(
        { success: false, error: `File size must be under ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      )
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(imageFile.type)) {
      reqLogger.warn({ mimeType: imageFile.type }, 'Invalid file type')
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: PNG, JPG, WEBP' },
        { status: 400 },
      )
    }

    // Validate accompanying text length
    if (accompanyingText && accompanyingText.length > 1000) {
      reqLogger.warn({ textLength: accompanyingText.length }, 'Accompanying text too long')
      return NextResponse.json(
        { success: false, error: 'Accompanying text must be under 1000 characters' },
        { status: 400 },
      )
    }

    // Convert File to Buffer
    const arrayBuffer = await imageFile.arrayBuffer()
    const imageBuffer = Buffer.from(arrayBuffer)

    reqLogger.info(
      {
        imageSize: imageBuffer.length,
        mimeType: imageFile.type,
        hasAccompanyingText: !!accompanyingText,
      },
      'Calling AI service',
    )

    // Call AI service
    const result = await generateExerciseFromImage({
      imageBuffer,
      mimeType: imageFile.type,
      accompanyingText: accompanyingText || undefined,
    })

    if (!result.success) {
      reqLogger.warn({ error: result.error }, 'AI service returned error')
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
      { processingTimeMs: result.metadata.processingTimeMs },
      'Exercise generated successfully',
    )

    return NextResponse.json({
      success: true,
      data: result.data,
      metadata: result.metadata,
      requestId,
    })
  } catch (error) {
    reqLogger.error({ err: error }, 'Error in image-to-exercise endpoint')

    Sentry.captureException(error, {
      tags: { endpoint: '/api/ai/image-to-exercise', requestId },
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process image',
        requestId,
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Image-to-Exercise AI endpoint',
    method: 'POST',
    documentation: {
      description: 'Convert an exercise image to structured JSON format',
      body: {
        image: 'File (PNG, JPG, WEBP - max 10MB)',
        accompanyingText: 'string (optional, max 1000 chars) - additional context',
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
      },
    },
  })
}

/**
 * V2 Queue API Endpoint
 *
 * Creates V2 conversion jobs for the image crop pipeline.
 * Unlike V1, V2 doesn't require prompt selection.
 *
 * @fileType api-route
 * @domain conversion
 * @pattern endpoint, queue
 */

import type { User } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Lesson } from '@/payload-types'
import { requireAdminOrTestSecret } from '@/server/api/auth'
import { queueV2RequestSchema } from '@/server/api/schemas/queue-schemas'

export { queueV2RequestSchema }

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'LESSON_NOT_FOUND'
  | 'MEDIA_NOT_ATTACHED'
  | 'INTERNAL_ERROR'

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  extra?: object,
): NextResponse {
  return NextResponse.json({ error: { code, message }, ...extra }, { status })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Auth: Admin Session OR Test-Only Secret
    const { user } = await payload.auth({ headers: request.headers })
    const authHeader = request.headers.get('authorization')

    try {
      requireAdminOrTestSecret(user as User | null, authHeader)
    } catch {
      return errorResponse('UNAUTHORIZED', 'Admin access required', 401)
    }

    const body = await request.json()
    const parsed = queueV2RequestSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        `Invalid request body: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
        400,
      )
    }
    const { lessonId, mediaId } = parsed.data

    // Fetch lesson to get tenant
    const lesson = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
    })

    if (!lesson) {
      return errorResponse('LESSON_NOT_FOUND', 'Lesson not found', 404)
    }

    const lessonTyped = lesson as unknown as Lesson
    const tenant = lessonTyped.tenant
    const lessonTenantId = typeof tenant === 'object' ? tenant?.id : tenant
    if (!lessonTenantId) {
      return errorResponse('VALIDATION_ERROR', 'Lesson has no tenant', 400)
    }

    // Validate media belongs to lesson
    const contentFiles = lessonTyped.contentFiles || []
    const mediaIds = contentFiles.map((m): string => (typeof m === 'string' ? m : m.id))
    if (!mediaIds.includes(mediaId)) {
      return errorResponse(
        'MEDIA_NOT_ATTACHED',
        'Media is not attached to this lesson. Save the lesson after attaching media and try again.',
        400,
      )
    }

    // Queue the V2 job
    const job = await payload.jobs.queue({
      task: 'pdf_to_exercises_v2' as const,
      input: {
        ctx: {
          lessonId,
          sourceDocId: mediaId,
          tenantId: lessonTenantId,
          pipelineVersion: 2,
          conversionMode: 'v2_crops',
        },
      },
    })

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'V2 conversion job queued',
    })
  } catch (error: unknown) {
    console.error('[Queue V2] Error:', error)
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      const typedError = error as { code: string; message: string }
      return errorResponse(typedError.code as ErrorCode, typedError.message, 400)
    }
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500)
  }
}

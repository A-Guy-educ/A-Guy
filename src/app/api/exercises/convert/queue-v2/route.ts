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

import { ENV } from '@/server/config/constants'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

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

    let isAdmin = false
    // Check if user is from 'users' collection (has 'role' property)
    // PayloadMcpApiKey doesn't have 'role', so we need to check collection
    if (user && 'collection' in user && user.collection === 'users' && user.role === 'admin') {
      isAdmin = true
    }

    const testSecret = process.env[ENV.TEST_ADMIN_SECRET]
    const authHeader = request.headers.get('authorization')
    if (
      process.env[ENV.NODE_ENV] === 'test' &&
      testSecret &&
      authHeader === `Bearer ${testSecret}`
    ) {
      isAdmin = true
    }

    if (!isAdmin) {
      return errorResponse('UNAUTHORIZED', 'Admin access required', 401)
    }

    const { lessonId, mediaId } = await request.json()

    // Validate required fields
    if (!lessonId || !mediaId) {
      return errorResponse('VALIDATION_ERROR', 'Both lessonId and mediaId are required', 400)
    }

    // Fetch lesson to get tenant
    const lesson = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
    })

    if (!lesson) {
      return errorResponse('LESSON_NOT_FOUND', 'Lesson not found', 404)
    }

    const tenant = (lesson as any).tenant
    const lessonTenantId = tenant?.id || tenant
    if (!lessonTenantId) {
      return errorResponse('VALIDATION_ERROR', 'Lesson has no tenant', 400)
    }

    // Validate media belongs to lesson
    const mediaIds = ((lesson as any).contentFiles || []).map((m: any) =>
      typeof m === 'string' ? m : m.id,
    )
    if (!mediaIds.includes(mediaId)) {
      return errorResponse('MEDIA_NOT_ATTACHED', 'Media is not attached to this lesson', 400)
    }

    // Queue the V2 job
    const job = await payload.jobs.queue({
      task: 'pdf_to_exercises_v2' as any,
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

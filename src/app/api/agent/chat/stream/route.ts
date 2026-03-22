// Initialize server-side config lazy loading before any other imports
// This ensures config values can be lazily loaded when accessed
import '@/infra/config/server-init'

import { logger } from '@/infra/utils/logger/logger'
import { agentChatStream } from '@/server/payload/endpoints/agent/chat-stream'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    logger.info({ requestId, url: request.url }, 'Streaming chat request received')

    // Parse request body early to validate
    const body = await request.json()

    // Validate required fields
    const hasContext =
      body.exerciseId || body.lessonId || body.chapterId || body.courseId || body.categoryId

    if (!hasContext) {
      logger.warn(
        {
          requestId,
          body: {
            exerciseId: body.exerciseId,
            lessonId: body.lessonId,
            chapterId: body.chapterId,
            courseId: body.courseId,
            categoryId: body.categoryId,
            adminMode: body.adminMode,
          },
        },
        'Missing context ID in streaming chat request (requires exerciseId, lessonId, chapterId, courseId, categoryId, or adminMode)',
      )
      return NextResponse.json(
        {
          error:
            'Missing context ID (requires exerciseId, lessonId, chapterId, courseId, categoryId, or adminMode)',
          requestId,
        },
        { status: 400 },
      )
    }

    // Reject media attachments for streaming
    if (body.mediaIds && body.mediaIds.length > 0) {
      logger.warn(
        { requestId, mediaIds: body.mediaIds },
        'Media attachments not supported in streaming mode',
      )
      return NextResponse.json(
        {
          error: 'Media attachments are not supported in streaming mode',
          requestId,
        },
        { status: 400 },
      )
    }

    // Get Payload instance and authenticate
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
      json: async () => body,
    } as Parameters<typeof agentChatStream>[0]

    logger.info(
      {
        requestId,
        exerciseId: body.exerciseId,
        lessonId: body.lessonId,
        chapterId: body.chapterId,
        courseId: body.courseId,
      },
      'Processing streaming chat request',
    )

    return await agentChatStream(payloadRequest)
  } catch (error) {
    logger.error({ err: error, requestId }, 'Streaming chat route error')
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureException(error, { tags: { route: '/api/agent/chat/stream' } })

    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required', requestId }, { status: 401 })
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        requestId,
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { stack: error.stack }
          : {}),
      },
      { status: 500 },
    )
  }
}

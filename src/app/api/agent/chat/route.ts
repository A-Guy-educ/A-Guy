// Initialize server-side config lazy loading before any other imports
// This ensures config values can be lazily loaded when accessed
import '@/infra/config/server-init'

import { logger } from '@/infra/utils/logger/logger'
import { agentChat } from '@/server/payload/endpoints/agent/chat'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    logger.info({ requestId, url: request.url }, 'Chat request received')

    // Parse request body early to validate
    const body = await request.json()

    // Validate required fields
    // At least one context ID must be provided OR adminMode must be true
    const hasContext =
      body.exerciseId || body.lessonId || body.chapterId || body.courseId || body.categoryId
    const hasAdminMode = body.adminMode === true

    if (!hasContext && !hasAdminMode) {
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
        'Missing context ID in chat request (requires exerciseId, lessonId, chapterId, courseId, categoryId, or adminMode)',
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

    if (!body.message?.trim()) {
      logger.warn({ requestId }, 'Missing or empty message in chat request')
      return NextResponse.json({ error: 'Missing message', requestId }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
      json: async () => body, // Return the already-parsed body
    } as Parameters<typeof agentChat>[0]

    logger.info(
      {
        requestId,
        exerciseId: body.exerciseId,
        lessonId: body.lessonId,
        chapterId: body.chapterId,
        courseId: body.courseId,
      },
      'Processing chat request',
    )
    return await agentChat(payloadRequest)
  } catch (error) {
    logger.error({ err: error, requestId }, 'Agent chat route error')
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureException(error, { tags: { route: '/api/agent/chat' } })

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

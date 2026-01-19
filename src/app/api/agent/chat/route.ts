import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { agentChat } from '@/endpoints/agent/chat'
import { logger } from '@/utilities/logger/logger'
import { RequestTiming } from '@/utilities/perf/request-timing'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const timing = new RequestTiming({ requestId, endpoint: '/api/agent/chat', logger })
  timing.markPoint('handler_entry')

  try {
    logger.info({ requestId, url: request.url }, 'Chat request received')

    // Parse request body early to validate
    const body = await request.json()

    // Validate required fields
    // At least one context ID must be provided (exerciseId, lessonId, chapterId, or courseId)
    const hasContext = body.exerciseId || body.lessonId || body.chapterId || body.courseId

    if (!hasContext) {
      logger.warn(
        {
          requestId,
          body: {
            exerciseId: body.exerciseId,
            lessonId: body.lessonId,
            chapterId: body.chapterId,
            courseId: body.courseId,
          },
        },
        'Missing context ID in chat request (requires exerciseId, lessonId, chapterId, or courseId)',
      )
      const { result: response } = timing.timeSync('serialization', () =>
        NextResponse.json(
          {
            error: 'Missing context ID (requires exerciseId, lessonId, chapterId, or courseId)',
            requestId,
          },
          { status: 400 },
        ),
      )
      timing.markPoint('handler_exit')
      timing.logIfSlow()
      return response
    }

    if (!body.message?.trim()) {
      logger.warn({ requestId }, 'Missing or empty message in chat request')
      const { result: response } = timing.timeSync('serialization', () =>
        NextResponse.json({ error: 'Missing message', requestId }, { status: 400 }),
      )
      timing.markPoint('handler_exit')
      timing.logIfSlow()
      return response
    }

    const { result: payload } = await timing.time('db_connect', () => getPayload({ config }))
    const { result: authResult } = await timing.time('auth', () =>
      payload.auth({ headers: request.headers }),
    )
    const { user } = authResult

    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
      json: async () => body, // Return the already-parsed body
      requestId,
      timing,
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
    const response = await agentChat(payloadRequest)
    timing.markPoint('handler_exit')
    timing.logIfSlow()
    return response
  } catch (error) {
    logger.error({ err: error, requestId }, 'Agent chat route error')
    timing.markPoint('handler_exit')
    const { result: response } = timing.timeSync('serialization', () =>
      NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Internal server error',
          requestId,
          ...(process.env.NODE_ENV === 'development' && error instanceof Error
            ? { stack: error.stack }
            : {}),
        },
        { status: 500 },
      ),
    )
    timing.logIfSlow()
    return response
  }
}

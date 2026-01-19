import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getConversation } from '@/endpoints/agent/get-conversation'
import { logger } from '@/utilities/logger/logger'
import { RequestTiming } from '@/utilities/perf/request-timing'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const timing = new RequestTiming({ requestId, endpoint: '/api/agent/conversation', logger })
  timing.markPoint('handler_entry')

  try {
    logger.info({ requestId, url: request.url }, 'Get conversation request received')

    // Parse request body early to validate
    const body = await request.json()

    // Validate required fields
    if (!body.contextKey) {
      logger.warn({ requestId }, 'Missing contextKey in get conversation request')
      const { result: response } = timing.timeSync('serialization', () =>
        NextResponse.json({ error: 'Missing contextKey', requestId }, { status: 400 }),
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
    } as Parameters<typeof getConversation>[0]

    logger.info({ requestId, contextKey: body.contextKey }, 'Processing get conversation request')
    const response = await getConversation(payloadRequest)
    timing.markPoint('handler_exit')
    timing.logIfSlow()
    return response
  } catch (error) {
    logger.error({ err: error, requestId }, 'Get conversation route error')
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
    timing.markPoint('handler_exit')
    timing.logIfSlow()
    return response
  }
}

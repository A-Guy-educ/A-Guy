import { agentResetChat } from '@/endpoints/agent/reset-chat'
import { logger } from '@/utilities/logger/logger'
import { RequestTiming } from '@/utilities/perf/request-timing'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const timing = new RequestTiming({ requestId, endpoint: '/api/agent/reset-chat', logger })
  timing.markPoint('handler_entry')

  try {
    logger.info({ requestId, url: request.url }, 'Reset chat request received')

    // Parse request body early to validate
    const body = await request.json()

    // Validate required fields
    if (!body.contextKey) {
      logger.warn({ requestId }, 'Missing contextKey in reset request')
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
      json: async () => body,
      requestId,
      timing,
    } as Parameters<typeof agentResetChat>[0]

    logger.info({ requestId, contextKey: body.contextKey }, 'Processing reset chat request')
    const response = await agentResetChat(payloadRequest)
    timing.markPoint('handler_exit')
    timing.logIfSlow()
    return response
  } catch (error) {
    logger.error({ err: error, requestId }, 'Reset chat route error')
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

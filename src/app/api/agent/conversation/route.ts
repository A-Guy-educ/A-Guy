import { getConfigValue } from '@/lib/config/runtime/bootstrap-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getConversation } from '@/server/payload/endpoints/agent/get-conversation'
import { logger } from '@/infra/utils/logger/logger'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    logger.info({ requestId, url: request.url }, 'Get conversation request received')

    // Parse request body early to validate
    const body = await request.json()

    // Validate required fields
    if (!body.contextKey) {
      logger.warn({ requestId }, 'Missing contextKey in get conversation request')
      return NextResponse.json({ error: 'Missing contextKey', requestId }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
      json: async () => body, // Return the already-parsed body
    } as Parameters<typeof getConversation>[0]

    logger.info({ requestId, contextKey: body.contextKey }, 'Processing get conversation request')
    return await getConversation(payloadRequest)
  } catch (error) {
    logger.error({ err: error, requestId }, 'Get conversation route error')
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        requestId,
        ...(getConfigValue('NODE_ENV') === 'development' && error instanceof Error
          ? { stack: error.stack }
          : {}),
      },
      { status: 500 },
    )
  }
}

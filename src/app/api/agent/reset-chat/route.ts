import { getConfigValue } from '@/lib/config/runtime/bootstrap-config'
import { agentResetChat } from '@/server/payload/endpoints/agent/reset-chat'
import { logger } from '@/infra/utils/logger/logger'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    logger.info({ requestId, url: request.url }, 'Reset chat request received')

    // Parse request body early to validate
    const body = await request.json()

    // Validate required fields
    if (!body.contextKey) {
      logger.warn({ requestId }, 'Missing contextKey in reset request')
      return NextResponse.json({ error: 'Missing contextKey', requestId }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
      json: async () => body,
    } as Parameters<typeof agentResetChat>[0]

    logger.info({ requestId, contextKey: body.contextKey }, 'Processing reset chat request')
    return await agentResetChat(payloadRequest)
  } catch (error) {
    logger.error({ err: error, requestId }, 'Reset chat route error')
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

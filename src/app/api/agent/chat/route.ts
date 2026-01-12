import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { agentChat } from '@/endpoints/agent/chat'
import { logger } from '@/utilities/logger/logger'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    logger.info({ requestId, url: request.url }, 'Chat request received')

    // Parse request body early to validate
    const body = await request.json()

    // Validate required fields
    if (!body.exerciseId) {
      logger.warn({ requestId }, 'Missing exerciseId in chat request')
      return NextResponse.json({ error: 'Missing exerciseId', requestId }, { status: 400 })
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

    logger.info({ requestId, exerciseId: body.exerciseId }, 'Processing chat request')
    return await agentChat(payloadRequest)
  } catch (error) {
    logger.error({ err: error, requestId }, 'Agent chat route error')
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

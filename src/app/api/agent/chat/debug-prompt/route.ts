// Initialize server-side config lazy loading before any other imports
import '@/infra/config/server-init'

import { logger } from '@/infra/utils/logger/logger'
import { agentChatDebugPrompt } from '@/server/payload/endpoints/agent/chat-debug-prompt'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  try {
    logger.info({ requestId, url: request.url }, 'Chat debug-prompt request')

    const body = await request.json()
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
      json: async () => body,
    } as Parameters<typeof agentChatDebugPrompt>[0]

    return await agentChatDebugPrompt(payloadRequest)
  } catch (error) {
    logger.error({ err: error, requestId }, 'Chat debug-prompt route error')
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        requestId,
      },
      { status: 500 },
    )
  }
}

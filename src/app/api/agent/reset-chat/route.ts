import { agentResetChat } from '@/server/payload/endpoints/agent/reset-chat'
import { logger } from '@/infra/utils/logger/logger'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { z } from 'zod'

const bodySchema = z.object({
  contextKey: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    logger.info({ requestId, url: request.url }, 'Reset chat request received')

    // Parse request body early to validate
    const body = await request.json()

    // Validate required fields
    const validated = bodySchema.parse(body)
    const contextKey = validated.contextKey

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
      json: async () => body,
    } as Parameters<typeof agentResetChat>[0]

    logger.info({ requestId, contextKey }, 'Processing reset chat request')
    return await agentResetChat(payloadRequest)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues, requestId },
        { status: 400 },
      )
    }

    logger.error({ err: error, requestId }, 'Reset chat route error')
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureException(error, { tags: { route: '/api/agent/reset-chat' } })

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

// Initialize server-side config lazy loading before any other imports
// This ensures config values can be lazily loaded when accessed
import '@/infra/config/server-init'

import { logger } from '@/infra/utils/logger/logger'
import { agentLearningChat } from '@/server/payload/endpoints/agent/learning-chat'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    logger.info({ requestId, url: request.url }, 'Learning chat request received')

    // Parse request body early to validate
    const body = await request.json()

    // Validate required fields
    if (!body.message?.trim()) {
      logger.warn({ requestId }, 'Missing or empty message in learning chat request')
      return NextResponse.json({ error: 'Missing message', requestId }, { status: 400 })
    }

    // gradeLevel is required for user learning context
    if (!body.gradeLevel?.trim()) {
      logger.warn({ requestId }, 'Missing gradeLevel in learning chat request')
      return NextResponse.json({ error: 'Missing gradeLevel', requestId }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    // Learning agent requires authentication
    if (!user) {
      logger.warn({ requestId }, 'Unauthenticated learning chat request')
      return NextResponse.json({ error: 'Authentication required', requestId }, { status: 401 })
    }

    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
      json: async () => body,
    } as Parameters<typeof agentLearningChat>[0]

    logger.info({ requestId, userId: user.id }, 'Processing learning chat request')
    return await agentLearningChat(payloadRequest)
  } catch (error) {
    logger.error({ err: error, requestId }, 'Learning chat route error')
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureException(error, { tags: { route: '/api/agent/learning-chat' } })

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

import '@/infra/config/server-init'

import { logger } from '@/infra/utils/logger/logger'
import { agentGenerateInteractiveLesson } from '@/server/payload/endpoints/agent/generate-interactive-lesson'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    const body = await request.json()

    if (!body.mediaId) {
      return NextResponse.json(
        { success: false, error: 'mediaId is required', requestId },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
      json: async () => body,
    } as Parameters<typeof agentGenerateInteractiveLesson>[0]

    return await agentGenerateInteractiveLesson(payloadRequest)
  } catch (error) {
    // Log full detail server-side; return a generic message so internals
    // (Gemini/Payload/OpenAI) don't leak to users.
    logger.error({ err: error, requestId }, 'Generate interactive lesson route error')

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate lesson. Please try again.',
        requestId,
      },
      { status: 500 },
    )
  }
}

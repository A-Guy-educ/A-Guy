import '@/infra/config/server-init'

import { logger } from '@/infra/utils/logger/logger'
import { wrongAnswerHelp } from '@/server/payload/endpoints/agent/wrong-answer-help'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    const body = await request.json()

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
      json: async () => body,
    } as Parameters<typeof wrongAnswerHelp>[0]

    return await wrongAnswerHelp(payloadRequest)
  } catch (error) {
    logger.error({ err: error, requestId }, 'Wrong-answer help route error')
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

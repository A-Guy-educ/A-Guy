import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { exerciseChat } from '@/endpoints/exercises/chat'
import { logger } from '@/utilities/logger/logger'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
      json: async () => request.json(),
    } as Parameters<typeof exerciseChat>[0]

    return await exerciseChat(payloadRequest)
  } catch (error) {
    logger.error({ err: error }, 'Exercise chat route error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

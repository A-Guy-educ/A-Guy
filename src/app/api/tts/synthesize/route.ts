import '@/infra/config/server-init'

import { logger } from '@/infra/utils/logger'
import { synthesizeRequestSchema, synthesizeSpeech } from '@/server/services/tts/google-cloud-tts'
import {
  checkAuthenticatedRateLimit,
  RATE_LIMIT_PRESETS,
  applyRateLimitHeaders,
} from '@/server/services/rate-limit'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const rateLimitResult = checkAuthenticatedRateLimit(
      user.id,
      'tts-synthesize',
      RATE_LIMIT_PRESETS.standard,
    )
    if (!rateLimitResult.allowed) {
      const headers = new Headers()
      applyRateLimitHeaders(headers, rateLimitResult, RATE_LIMIT_PRESETS.standard.maxRequests)
      return NextResponse.json({ error: 'Too many requests', requestId }, { status: 429, headers })
    }

    const body = await request.json()
    const parsed = synthesizeRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten(), requestId },
        { status: 400 },
      )
    }

    logger.info(
      { requestId, locale: parsed.data.locale, textLength: parsed.data.text.length },
      '[TTS] Synthesize request',
    )

    const audioContent = await synthesizeSpeech(parsed.data.text, parsed.data.locale, payload)

    return NextResponse.json({ audioContent })
  } catch (error) {
    logger.error({ err: error, requestId }, '[TTS] Synthesize route error')
    return NextResponse.json({ error: 'Speech synthesis failed', requestId }, { status: 500 })
  }
}

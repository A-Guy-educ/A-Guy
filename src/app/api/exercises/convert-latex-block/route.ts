/**
 * POST /api/exercises/convert-latex-block
 * Next.js App Router wrapper for in-place LaTeX-block → structured-content
 * conversion on a single exercise.
 *
 * Accepts { exerciseId } in the JSON body (not URL param) to avoid collision
 * with Payload's catch-all REST handler at /api/exercises/:id.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import config from '@payload-config'
import { convertLatexBlockOnExercise } from '@/server/payload/endpoints/exercises/convert-latex-block'
import { logger } from '@/infra/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    const body = await request.json()
    const exerciseId = body?.exerciseId
    if (!exerciseId || typeof exerciseId !== 'string') {
      return NextResponse.json({ error: 'Missing exerciseId in body' }, { status: 400 })
    }

    const payloadRequest = {
      payload,
      user: user || undefined,
      url: request.url,
      headers: request.headers,
      routeParams: {},
      context: {},
    } as unknown as PayloadRequest

    return await convertLatexBlockOnExercise(payloadRequest, exerciseId)
  } catch (error) {
    logger.error({ err: error }, '[API Route] Error in /api/exercises/convert-latex-block')

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

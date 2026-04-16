/**
 * POST /api/exercises/import-latex-unified
 * Next.js App Router route wrapping the unified (script-first, AI-fallback)
 * LaTeX import service.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import config from '@payload-config'
import { importExerciseFromLatexUnified } from '@/server/payload/endpoints/exercises/import-from-latex-unified'
import { logger } from '@/infra/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    const body = await request.json()
    const payloadRequest: PayloadRequest = {
      payload,
      user: user || undefined,
      url: request.url,
      headers: request.headers,
      routeParams: {},
      context: {},
      json: body,
    } as PayloadRequest

    return await importExerciseFromLatexUnified(payloadRequest)
  } catch (error) {
    logger.error({ err: error }, '[API Route] Error in /api/exercises/import-latex-unified')

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

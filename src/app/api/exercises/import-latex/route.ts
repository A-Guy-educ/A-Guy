/**
 * POST /api/exercises/import-latex
 * Next.js App Router route wrapping the Payload endpoint for LaTeX import.
 *
 * Payload 3.x custom endpoints in config don't automatically create Next.js routes,
 * so we need this explicit route file.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import config from '@payload-config'
import { importExerciseFromLatex } from '@/server/payload/endpoints/exercises/import-from-latex'
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

    return await importExerciseFromLatex(payloadRequest)
  } catch (error) {
    logger.error({ err: error }, '[API Route] Error in /api/exercises/import-latex')

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

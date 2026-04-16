/**
 * POST /api/exercises/:id/convert-latex-block
 * Next.js App Router wrapper for in-place LaTeX-block → structured-content
 * conversion on a single exercise.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import config from '@payload-config'
import { convertLatexBlockOnExercise } from '@/server/payload/endpoints/exercises/convert-latex-block'
import { logger } from '@/infra/utils/logger'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing exercise id' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    const payloadRequest = {
      payload,
      user: user || undefined,
      url: request.url,
      headers: request.headers,
      routeParams: { id },
      context: {},
    } as unknown as PayloadRequest

    return await convertLatexBlockOnExercise(payloadRequest, id)
  } catch (error) {
    logger.error({ err: error }, '[API Route] Error in /api/exercises/:id/convert-latex-block')

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

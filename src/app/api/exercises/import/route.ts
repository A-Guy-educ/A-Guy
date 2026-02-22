/**
 * POST /api/exercises/import?lessonId=<id>
 * Convert lesson contentFile to exercise using AI
 *
 * This is a Next.js App Router API route that wraps the Payload endpoint logic.
 * Payload 3.x custom endpoints in config don't automatically create Next.js routes,
 * so we need this explicit route file.
 */
import { logger } from '@/infra/utils/logger'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import config from '@payload-config'
import { importExerciseFromLesson } from '@/server/payload/endpoints/exercises/import-from-lesson'
import { importExerciseFromImage } from '@/server/payload/endpoints/exercises/import-from-image'

const log = logger.child({ route: 'exercises-import' })

export async function POST(request: NextRequest) {
  try {
    // Get Payload instance
    const payload = await getPayload({ config })

    // Get authenticated user
    const { user } = await payload.auth({ headers: request.headers })

    // Determine which handler to use based on query param
    const url = new URL(request.url)
    const lessonId = url.searchParams.get('lessonId')

    // Create a PayloadRequest-like object (minimal required fields)
    // PayloadRequest has many optional fields, so we create a partial one
    const payloadRequest: PayloadRequest = {
      payload,
      user: user || undefined,
      url: request.url,
      headers: request.headers,
      routeParams: {},
      context: {},
    } as PayloadRequest

    // Route to appropriate handler
    if (lessonId) {
      log.info({ lessonId }, '[API Route] Calling importExerciseFromLesson')
      return await importExerciseFromLesson(payloadRequest)
    } else {
      log.info('[API Route] Calling importExerciseFromImage')
      return await importExerciseFromImage(payloadRequest)
    }
  } catch (error) {
    log.error({ err: error }, '[API Route] Error in /api/exercises/import')

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

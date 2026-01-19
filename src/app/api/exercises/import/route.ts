/**
 * POST /api/exercises/import?lessonId=<id>
 * Convert lesson contentFile to exercise using AI
 *
 * This is a Next.js App Router API route that wraps the Payload endpoint logic.
 * Payload 3.x custom endpoints in config don't automatically create Next.js routes,
 * so we need this explicit route file.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import config from '@payload-config'
import { importExerciseFromLesson } from '@/endpoints/exercises/import-from-lesson'
import { importExerciseFromImage } from '@/endpoints/exercises/import-from-image'
import { RequestTiming } from '@/utilities/perf/request-timing'
import { logger } from '@/utilities/logger'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const timing = new RequestTiming({ requestId, endpoint: '/api/exercises/import', logger })
  timing.markPoint('handler_entry')

  try {
    // Get Payload instance
    const { result: payload } = await timing.time('db_connect', () => getPayload({ config }))

    // Get authenticated user
    const { result: authResult } = await timing.time('auth', () =>
      payload.auth({ headers: request.headers }),
    )
    const { user } = authResult

    // Determine which handler to use based on query param
    const url = new URL(request.url)
    const lessonId = url.searchParams.get('lessonId')

    // Create a PayloadRequest-like object (minimal required fields)
    // PayloadRequest has many optional fields, so we create a partial one
    const payloadRequest = {
      payload,
      user: user || undefined,
      url: request.url,
      headers: request.headers,
      routeParams: {},
      context: {},
      requestId,
      timing,
    } as unknown as PayloadRequest

    // Route to appropriate handler
    if (lessonId) {
      console.log('[API Route] Calling importExerciseFromLesson for lessonId:', lessonId)
      const response = await importExerciseFromLesson(payloadRequest)
      timing.markPoint('handler_exit')
      timing.logIfSlow()
      return response
    } else {
      console.log('[API Route] Calling importExerciseFromImage')
      const response = await importExerciseFromImage(payloadRequest)
      timing.markPoint('handler_exit')
      timing.logIfSlow()
      return response
    }
  } catch (error) {
    console.error('[API Route] Error in /api/exercises/import:', error)

    const { result: response } = timing.timeSync('serialization', () =>
      NextResponse.json(
        {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      ),
    )
    timing.markPoint('handler_exit')
    timing.logIfSlow()
    return response
  }
}

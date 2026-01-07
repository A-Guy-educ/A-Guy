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
import config from '@payload-config'
import { importExerciseFromLesson } from '@/endpoints/exercises/import-from-lesson'
import { importExerciseFromImage } from '@/endpoints/exercises/import-from-image'

export async function POST(request: NextRequest) {
  try {
    // Get Payload instance
    const payload = await getPayload({ config })

    // Get authenticated user
    const { user } = await payload.auth({ headers: request.headers })

    // Determine which handler to use based on query param
    const url = new URL(request.url)
    const lessonId = url.searchParams.get('lessonId')

    // Create a PayloadRequest-like object
    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
    } as any

    // Route to appropriate handler
    if (lessonId) {
      console.log('[API Route] Calling importExerciseFromLesson for lessonId:', lessonId)
      return await importExerciseFromLesson(payloadRequest)
    } else {
      console.log('[API Route] Calling importExerciseFromImage')
      return await importExerciseFromImage(payloadRequest)
    }
  } catch (error) {
    console.error('[API Route] Error in /api/exercises/import:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

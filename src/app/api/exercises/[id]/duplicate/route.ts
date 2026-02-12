/**
 * POST /api/exercises/[id]/duplicate
 * Duplicate an exercise with a unique slug
 *
 * This is a Next.js App Router API route that wraps the Payload endpoint logic.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import config from '@payload-config'
import { duplicateExercise } from '@/server/payload/endpoints/exercises/duplicate'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get Payload instance
    const payload = await getPayload({ config })

    // Get authenticated user
    const { user } = await payload.auth({ headers: request.headers })

    // Create a PayloadRequest-like object (minimal required fields)
    const payloadRequest: PayloadRequest = {
      payload,
      user: user || undefined,
      url: request.url,
      headers: request.headers,
      routeParams: { id: params.id },
      context: {},
    } as PayloadRequest

    return await duplicateExercise(payloadRequest)
  } catch (error) {
    console.error('[API Route] Error in /api/exercises/[id]/duplicate:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

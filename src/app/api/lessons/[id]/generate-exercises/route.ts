/**
 * POST /api/lessons/:id/generate-exercises
 *
 * Next.js App Router wrapper around the Payload endpoint.
 *
 * @fileType api-route
 * @domain lessons
 * @pattern payload-endpoint-wrapper
 * @ai-summary Forwards POST to the Payload generate-exercises endpoint with auth + payload context attached.
 *
 * Access: admin only (enforced inside the endpoint handler).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

import { generateExercisesEndpoint } from '@/server/payload/endpoints/lessons/generate-exercises'

export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    // Buffer the request body so we can re-expose it as `req.json()` to the
    // Payload handler — Next's request body can only be consumed once.
    const body = await request.json().catch(() => ({}))

    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
      json: async () => body,
    } as unknown as Parameters<typeof generateExercisesEndpoint>[0]

    return await generateExercisesEndpoint(payloadRequest)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Generate exercises endpoint failed: ${message}` },
      { status: 500 },
    )
  }
}

/**
 * Lesson Duplication Variation API
 *
 * POST /api/lessons/:id/duplicate-variation
 *
 * Next.js App Router wrapper around the Payload endpoint
 * `duplicateLessonEndpoint`. The path is deliberately /duplicate-variation
 * (not /duplicate) because Payload's built-in collection duplicate handler
 * also claims /api/lessons/:id/duplicate and silently runs its dumb field-copy
 * before our endpoint can answer.
 *
 * @fileType api-route
 * @domain lesson-duplication
 * @pattern payload-endpoint-wrapper
 * @ai-summary Forwards POST to the Payload duplicate endpoint with auth + payload context attached.
 *
 * Access: admin only (enforced inside the endpoint handler).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

import { duplicateLessonEndpoint } from '@/server/payload/endpoints/lessons/duplicate'

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
    } as unknown as Parameters<typeof duplicateLessonEndpoint>[0]

    return await duplicateLessonEndpoint(payloadRequest)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Duplicate endpoint failed: ${message}` }, { status: 500 })
  }
}

/**
 * Lesson Export API
 *
 * GET /api/lessons/:id/export
 *
 * Next.js App Router wrapper around the Payload endpoint
 * `exportLessonEndpoint`. Sets Content-Type and Content-Disposition
 * for browser file download.
 *
 * @fileType api-route
 * @domain lessons
 * @pattern payload-endpoint-wrapper
 * @ai-summary Forwards GET to the Payload export endpoint with auth + payload context attached.
 *
 * Access: admin only (enforced inside the endpoint handler).
 */
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

import { exportLessonEndpoint } from '@/server/payload/endpoints/lessons/export'

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    const payloadRequest = {
      payload,
      user,
      url: request.url,
      headers: request.headers,
    } as unknown as Parameters<typeof exportLessonEndpoint>[0]

    return await exportLessonEndpoint(payloadRequest)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Export failed: ${message}` }, { status: 500 })
  }
}

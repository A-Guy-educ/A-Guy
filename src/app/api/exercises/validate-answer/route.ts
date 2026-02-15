/**
 * POST /api/exercises/validate-answer
 * Next.js route wrapper for answer validation endpoint
 */
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import config from '@payload-config'
import { validateAnswer } from '@/server/payload/endpoints/exercises/validate-answer'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    const body = await request.json()

    const payloadRequest = {
      payload,
      user: user || undefined,
      url: request.url,
      headers: request.headers,
      json: async () => body,
      routeParams: {},
      context: {},
    } as PayloadRequest & { json: () => Promise<unknown> }

    return await validateAnswer(payloadRequest)
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

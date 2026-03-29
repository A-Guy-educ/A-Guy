/**
 * POST /api/cron/media-expiry
 * API route for media expiry cleanup cron job
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

import { ENV } from '@/server/config/constants'
import { mediaExpiryCleanupEndpoint } from '@/server/payload/endpoints/cron/media-expiry'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env[ENV.CRON_SECRET]

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config: configPromise })

  const payloadRequest = {
    payload,
    headers: request.headers,
  } as Parameters<typeof mediaExpiryCleanupEndpoint.handler>[0]

  return await mediaExpiryCleanupEndpoint.handler(payloadRequest)
}

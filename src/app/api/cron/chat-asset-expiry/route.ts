/**
 * POST /api/cron/chat-asset-expiry
 * API route for chat asset expiry cleanup cron job
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

import { ENV } from '@/server/config/constants'
import { chatAssetExpiryEndpoint } from '@/server/payload/endpoints/cron/chat-asset-expiry'

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
  } as Parameters<typeof chatAssetExpiryEndpoint.handler>[0]

  return await chatAssetExpiryEndpoint.handler(payloadRequest)
}

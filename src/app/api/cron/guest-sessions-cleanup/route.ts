/**
 * POST /api/cron/guest-sessions-cleanup
 * API route for guest sessions cleanup cron job
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

import { guestSessionsCleanupEndpoint } from '@/server/payload/endpoints/cron/guest-sessions-cleanup'

export async function POST(request: Request) {
  const payload = await getPayload({ config: configPromise })

  const payloadRequest = {
    payload,
    headers: request.headers,
  } as Parameters<typeof guestSessionsCleanupEndpoint.handler>[0]

  return await guestSessionsCleanupEndpoint.handler(payloadRequest)
}

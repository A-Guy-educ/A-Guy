/**
 * POST /api/cron/upload-session-cleanup
 * API route for upload session cleanup cron job
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

import { uploadSessionCleanupEndpoint } from '@/server/payload/endpoints/cron/upload-session-cleanup'

export async function POST(request: Request) {
  const payload = await getPayload({ config: configPromise })

  const payloadRequest = {
    payload,
    headers: request.headers,
  } as Parameters<typeof uploadSessionCleanupEndpoint.handler>[0]

  return await uploadSessionCleanupEndpoint.handler(payloadRequest)
}

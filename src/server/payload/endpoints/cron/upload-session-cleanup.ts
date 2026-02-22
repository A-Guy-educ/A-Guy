/**
 * Upload Session Cleanup Cron Job
 * Deletes orphaned upload sessions and their associated blobs
 */

import type { PayloadRequest } from 'payload'

import { logger } from '@/infra/utils/logger'
import { withCronMiddleware, type CronResult } from './cron-middleware'

interface CleanupResult {
  deletedSessions: number
  failedDeletions: number
  errors: string[]
}

async function cleanupUploadSessions({
  payload,
  reqLogger,
}: {
  payload: PayloadRequest['payload']
  reqLogger: typeof logger
}): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedSessions: 0,
    failedDeletions: 0,
    errors: [],
  }

  const now = new Date().toISOString()

  let hasMore = true
  while (hasMore) {
    try {
      const { docs: expiredSessions } = await payload.find({
        collection: 'upload-sessions',
        where: {
          and: [
            {
              or: [
                { status: { equals: 'initiated' } },
                { status: { equals: 'uploaded' } },
                { status: { equals: 'failed' } },
                { status: { equals: 'cancelled' } },
              ],
            },
            {
              expiresAt: { less_than_equal: now },
            },
          ],
        },
        limit: 100,
        overrideAccess: true,
      })

      hasMore = expiredSessions.length === 100

      reqLogger.info(
        { count: expiredSessions.length },
        '[upload-session-cleanup] Found expired sessions',
      )

      for (const session of expiredSessions) {
        try {
          if (session.blobUrl) {
            try {
              const { del } = await import('@vercel/blob')
              await del(session.blobUrl)
              reqLogger.info(
                { sessionId: session.id, blobUrl: session.blobUrl },
                '[upload-session-cleanup] Deleted blob',
              )
            } catch (blobError) {
              const errorMessage =
                blobError instanceof Error ? blobError.message : String(blobError)
              reqLogger.warn(
                { sessionId: session.id, error: errorMessage },
                '[upload-session-cleanup] Failed to delete blob',
              )
              result.failedDeletions++
              result.errors.push(`Session ${session.id}: blob delete failed - ${errorMessage}`)
            }
          }

          await payload.delete({
            collection: 'upload-sessions',
            id: session.id,
            overrideAccess: true,
          })

          result.deletedSessions++
          reqLogger.info({ sessionId: session.id }, '[upload-session-cleanup] Deleted session')
        } catch (sessionError) {
          const errorMessage =
            sessionError instanceof Error ? sessionError.message : String(sessionError)
          reqLogger.error(
            { sessionId: session.id, error: errorMessage },
            '[upload-session-cleanup] Failed to delete session',
          )
          result.errors.push(`Session ${session.id}: delete failed - ${errorMessage}`)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      reqLogger.error({ error: errorMessage }, '[upload-session-cleanup] Fatal error')
      result.errors.push(`Fatal error: ${errorMessage}`)
      return result
    }
  }

  return result
}

export const uploadSessionCleanupEndpoint = {
  path: '/cron/upload-session-cleanup',
  method: 'post',
  handler: withCronMiddleware(async ({ payload, reqLogger }): Promise<CronResult> => {
    const result = await cleanupUploadSessions({ payload, reqLogger })

    if (result.errors.length > 0) {
      return {
        success: false,
        error: `Completed with ${result.errors.length} errors`,
        statusCode: 207,
      }
    }

    return {
      success: true,
      data: {
        deletedSessions: result.deletedSessions,
        failedDeletions: result.failedDeletions,
      },
    }
  }),
}

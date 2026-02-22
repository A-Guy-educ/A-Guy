/**
 * Chat Asset Expiry Cleanup Cron Job
 * Deletes expired ephemeral chat assets and their associated blobs
 */

import type { PayloadRequest } from 'payload'

import { logger } from '@/infra/utils/logger'
import { withCronMiddleware, type CronResult } from './cron-middleware'

interface ExpiryCleanupResult {
  deletedAssets: number
  failedDeletions: number
  errors: string[]
}

async function cleanupExpiredChatAssets({
  payload,
  reqLogger,
}: {
  payload: PayloadRequest['payload']
  reqLogger: typeof logger
}): Promise<ExpiryCleanupResult> {
  const result: ExpiryCleanupResult = {
    deletedAssets: 0,
    failedDeletions: 0,
    errors: [],
  }

  const now = new Date().toISOString()

  let hasMore = true
  while (hasMore) {
    try {
      const { docs: expiredAssets } = await payload.find({
        collection: 'chat-assets',
        where: {
          and: [
            { retentionPolicy: { equals: 'ephemeral' } },
            { expiresAt: { less_than_equal: now } },
          ],
        },
        limit: 100,
        overrideAccess: true,
      })

      hasMore = expiredAssets.length === 100

      reqLogger.info({ count: expiredAssets.length }, '[chat-asset-expiry] Found expired assets')

      for (const asset of expiredAssets) {
        try {
          if (asset.url) {
            try {
              const { del } = await import('@vercel/blob')
              await del(asset.url)
              reqLogger.info(
                { assetId: asset.id, url: asset.url },
                '[chat-asset-expiry] Deleted blob',
              )
            } catch (blobError) {
              const errorMessage =
                blobError instanceof Error ? blobError.message : String(blobError)
              reqLogger.warn(
                { assetId: asset.id, error: errorMessage },
                '[chat-asset-expiry] Failed to delete blob',
              )
              result.failedDeletions++
              result.errors.push(`Asset ${asset.id}: blob delete failed - ${errorMessage}`)
            }
          }

          await payload.delete({
            collection: 'chat-assets',
            id: asset.id,
            overrideAccess: true,
          })

          result.deletedAssets++
          reqLogger.info({ assetId: asset.id }, '[chat-asset-expiry] Deleted asset')
        } catch (assetError) {
          const errorMessage = assetError instanceof Error ? assetError.message : String(assetError)
          reqLogger.error(
            { assetId: asset.id, error: errorMessage },
            '[chat-asset-expiry] Failed to delete asset',
          )
          result.errors.push(`Asset ${asset.id}: delete failed - ${errorMessage}`)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      reqLogger.error({ error: errorMessage }, '[chat-asset-expiry] Fatal error')
      result.errors.push(`Fatal error: ${errorMessage}`)
      return result
    }
  }

  return result
}

export const chatAssetExpiryEndpoint = {
  path: '/cron/chat-asset-expiry',
  method: 'post',
  handler: withCronMiddleware(async ({ payload, reqLogger }): Promise<CronResult> => {
    const result = await cleanupExpiredChatAssets({ payload, reqLogger })

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
        deletedAssets: result.deletedAssets,
        failedDeletions: result.failedDeletions,
      },
    }
  }),
}

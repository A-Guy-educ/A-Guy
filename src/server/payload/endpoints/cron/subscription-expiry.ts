/**
 * Subscription Expiry Cron Job
 *
 * @fileType endpoint
 * @domain payments
 * @ai-summary Daily cron to expire overdue subscriptions
 */

import type { PayloadRequest } from 'payload'

import { logger } from '@/infra/utils/logger'
import { withCronMiddleware, type CronResult } from './cron-middleware'

import type { User } from '@/payload-types'

interface ExpiryResult {
  processed: number
  expired: number
  cancelled: number
  errors: string[]
}

async function processExpiredSubscriptions({
  payload,
  reqLogger,
}: {
  payload: PayloadRequest['payload']
  reqLogger: typeof logger
}): Promise<ExpiryResult> {
  const result: ExpiryResult = {
    processed: 0,
    expired: 0,
    cancelled: 0,
    errors: [],
  }

  const now = new Date().toISOString()

  // Find active subscriptions where currentPeriodEnd has passed
  let hasMore = true
  while (hasMore) {
    try {
      const { docs: expiredSubscriptions } = await payload.find({
        collection: 'subscriptions',
        where: {
          and: [{ status: { equals: 'active' } }, { currentPeriodEnd: { less_than_equal: now } }],
        },
        limit: 100,
        depth: 1,
        overrideAccess: true,
      })

      hasMore = expiredSubscriptions.length === 100

      for (const subscription of expiredSubscriptions) {
        try {
          const userId =
            typeof subscription.user === 'string'
              ? subscription.user
              : (subscription.user as { id: string })?.id

          if (subscription.cancelAtPeriodEnd) {
            // User chose to cancel - mark as cancelled, keep access until period end
            await payload.update({
              collection: 'subscriptions',
              id: subscription.id,
              data: {
                status: 'cancelled',
                cancelledAt: now,
              },
              overrideAccess: true,
            })

            await payload.update({
              collection: 'users',
              id: userId,
              data: {
                subscriptionStatus: 'cancelled',
              },
              overrideAccess: true,
            })

            result.cancelled++
          } else {
            // Subscription expired - revoke entitlements
            await payload.update({
              collection: 'subscriptions',
              id: subscription.id,
              data: {
                status: 'expired',
              },
              overrideAccess: true,
            })

            // Process expired entitlements
            const user = (await payload.findByID({
              collection: 'users',
              id: userId,
              depth: 0,
              overrideAccess: true,
              select: { courseEntitlements: true, subscriptionStatus: true },
            })) as User | null

            if (user?.courseEntitlements) {
              const nowDate = new Date()
              const validEntitlements = user.courseEntitlements.filter((e) => {
                if (e.grantMethod !== 'payment') return true
                if (!e.expiresAt) return true
                return new Date(e.expiresAt) > nowDate
              })

              await payload.update({
                collection: 'users',
                id: userId,
                data: {
                  subscriptionStatus: 'expired',
                  courseEntitlements: validEntitlements,
                },
                overrideAccess: true,
              })
            } else {
              await payload.update({
                collection: 'users',
                id: userId,
                data: {
                  subscriptionStatus: 'expired',
                },
                overrideAccess: true,
              })
            }

            result.expired++
          }

          result.processed++
          reqLogger.info(
            { subscriptionId: subscription.id, userId },
            '[subscription-expiry] Processed subscription',
          )
        } catch (subError) {
          const errorMsg = subError instanceof Error ? subError.message : String(subError)
          result.errors.push(`Subscription ${subscription.id}: ${errorMsg}`)
          reqLogger.error(
            { subscriptionId: subscription.id, error: errorMsg },
            '[subscription-expiry] Failed to process subscription',
          )
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      result.errors.push(`Fatal error: ${errorMsg}`)
      reqLogger.error({ error: errorMsg }, '[subscription-expiry] Fatal error')
      return result
    }
  }

  return result
}

export const subscriptionExpiryEndpoint = {
  path: '/cron/subscription-expiry',
  method: 'post',
  handler: withCronMiddleware(async ({ payload, reqLogger }): Promise<CronResult> => {
    const result = await processExpiredSubscriptions({ payload, reqLogger })

    reqLogger.info(
      {
        processed: result.processed,
        expired: result.expired,
        cancelled: result.cancelled,
        errors: result.errors.length,
      },
      '[subscription-expiry] Cron completed',
    )

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
        processed: result.processed,
        expired: result.expired,
        cancelled: result.cancelled,
      },
    }
  }),
}

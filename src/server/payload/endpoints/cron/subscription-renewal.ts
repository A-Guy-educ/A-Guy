/**
 * Subscription Renewal Cron Job
 *
 * @fileType endpoint
 * @domain payments
 * @ai-summary Daily cron to trigger renewal before period ends
 */

import type { PayloadRequest } from 'payload'

import { logger } from '@/infra/utils/logger'
import { withCronMiddleware, type CronResult } from './cron-middleware'

import type { User } from '@/payload-types'

interface RenewalResult {
  processed: number
  renewed: number
  failed: number
  errors: string[]
}

async function processRenewals({
  payload,
  reqLogger,
}: {
  payload: PayloadRequest['payload']
  reqLogger: typeof logger
}): Promise<RenewalResult> {
  const result: RenewalResult = {
    processed: 0,
    renewed: 0,
    failed: 0,
    errors: [],
  }

  // Find active subscriptions expiring within 3 days
  const threeDaysFromNow = new Date()
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
  const now = new Date().toISOString()

  let hasMore = true
  while (hasMore) {
    try {
      const { docs: renewingSubscriptions } = await payload.find({
        collection: 'subscriptions',
        where: {
          and: [
            { status: { equals: 'active' } },
            { currentPeriodEnd: { greater_than_equal: now } },
            { currentPeriodEnd: { less_than_equal: threeDaysFromNow.toISOString() } },
          ],
        },
        limit: 100,
        depth: 1,
        overrideAccess: true,
      })

      hasMore = renewingSubscriptions.length === 100

      for (const subscription of renewingSubscriptions) {
        try {
          const userId =
            typeof subscription.user === 'string'
              ? subscription.user
              : (subscription.user as { id: string })?.id

          // Calculate new period end
          const currentEnd = new Date(subscription.currentPeriodEnd)
          const pricingPlanObj = subscription.pricingPlan
          const interval =
            typeof pricingPlanObj === 'object' && pricingPlanObj !== null
              ? pricingPlanObj.interval || 'month'
              : 'month'

          const newPeriodEnd = new Date(currentEnd)
          if (interval === 'month') {
            newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)
          } else if (interval === 'year') {
            newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1)
          }

          // In a real implementation, this would call Tranzila's recurring charge API
          // For now, we'll simulate a successful renewal
          const renewalSuccess = true

          if (renewalSuccess) {
            // Update subscription with new period
            await payload.update({
              collection: 'subscriptions',
              id: subscription.id,
              data: {
                currentPeriodEnd: newPeriodEnd.toISOString(),
              },
              overrideAccess: true,
            })

            // Update user period end
            await payload.update({
              collection: 'users',
              id: userId,
              data: {
                currentPeriodEnd: newPeriodEnd.toISOString(),
              },
              overrideAccess: true,
            })

            // Extend entitlement expiresAt
            const user = (await payload.findByID({
              collection: 'users',
              id: userId,
              depth: 0,
              overrideAccess: true,
              select: { courseEntitlements: true },
            })) as User | null

            if (user?.courseEntitlements) {
              const updatedEntitlements = user.courseEntitlements.map((e) => {
                if (e.grantMethod !== 'payment') return e
                if (!e.expiresAt) return e
                // Only extend if expiresAt is at the old period end
                const oldExpiry = new Date(e.expiresAt)
                if (oldExpiry.getTime() <= currentEnd.getTime()) {
                  return { ...e, expiresAt: newPeriodEnd.toISOString() }
                }
                return e
              })

              await payload.update({
                collection: 'users',
                id: userId,
                data: {
                  courseEntitlements: updatedEntitlements,
                },
                overrideAccess: true,
              })
            }

            result.renewed++
            reqLogger.info(
              { subscriptionId: subscription.id, userId, newPeriodEnd: newPeriodEnd.toISOString() },
              '[subscription-renewal] Subscription renewed',
            )
          } else {
            // Renewal failed
            await payload.update({
              collection: 'subscriptions',
              id: subscription.id,
              data: {
                status: 'failed',
              },
              overrideAccess: true,
            })

            await payload.update({
              collection: 'users',
              id: userId,
              data: {
                subscriptionStatus: 'failed',
              },
              overrideAccess: true,
            })

            result.failed++
            reqLogger.warn(
              { subscriptionId: subscription.id, userId },
              '[subscription-renewal] Renewal failed',
            )
          }

          result.processed++
        } catch (subError) {
          const errorMsg = subError instanceof Error ? subError.message : String(subError)
          result.errors.push(`Subscription ${subscription.id}: ${errorMsg}`)
          reqLogger.error(
            { subscriptionId: subscription.id, error: errorMsg },
            '[subscription-renewal] Failed to process subscription',
          )
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      result.errors.push(`Fatal error: ${errorMsg}`)
      reqLogger.error({ error: errorMsg }, '[subscription-renewal] Fatal error')
      return result
    }
  }

  return result
}

export const subscriptionRenewalEndpoint = {
  path: '/cron/subscription-renewal',
  method: 'post',
  handler: withCronMiddleware(async ({ payload, reqLogger }): Promise<CronResult> => {
    const result = await processRenewals({ payload, reqLogger })

    reqLogger.info(
      {
        processed: result.processed,
        renewed: result.renewed,
        failed: result.failed,
        errors: result.errors.length,
      },
      '[subscription-renewal] Cron completed',
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
        renewed: result.renewed,
        failed: result.failed,
      },
    }
  }),
}

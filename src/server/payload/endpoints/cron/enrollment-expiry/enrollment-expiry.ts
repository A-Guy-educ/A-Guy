/**
 * POST /api/cron/enrollment-expiry
 * Cron job: expire approved enrollments past their expiresAt date
 *
 * @fileType endpoint
 * @domain lms
 * @pattern cron-endpoint
 * @ai-summary Automatically expires approved enrollments that have passed their expiry date
 *
 * Access: Requires CRON_SECRET bearer token
 */

import type { Endpoint } from 'payload'

import { withCronMiddleware, type CronResult } from '../cron-middleware'

interface ExpiryStats {
  expiredCount: number
  failedUpdates: string[]
}

/**
 * Find and expire approved enrollments past their expiresAt date.
 */
async function expireEnrollments(payload: Endpoint['handler'] extends (req: infer R) => unknown ? R extends { payload: infer P } ? P : never : never, reqLogger: Parameters<typeof withCronMiddleware>[0] extends (ctx: infer C) => unknown ? C extends { reqLogger: infer L } ? L : never : never): Promise<CronResult> {
  // Dynamic import to avoid circular deps — payload is passed by middleware
  const { revokeCourseEntitlement } = await import('@/server/services/enrollment-grant')

  const now = new Date().toISOString()
  const stats: ExpiryStats = {
    expiredCount: 0,
    failedUpdates: [],
  }

  let hasMore = true
  while (hasMore) {
    const { docs: expiredEnrollments } = await payload.find({
      collection: 'enrollments',
      where: {
        and: [
          { status: { equals: 'approved' } },
          { expiresAt: { exists: true } },
          { expiresAt: { less_than_equal: now } },
        ],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    hasMore = expiredEnrollments.length === 100

    for (const enrollment of expiredEnrollments) {
      const studentId = typeof enrollment.student === 'string'
        ? enrollment.student
        : (enrollment.student as { id: string })?.id
      const courseId = typeof enrollment.course === 'string'
        ? enrollment.course
        : (enrollment.course as { id: string })?.id

      if (!studentId || !courseId) continue

      try {
        await payload.update({
          collection: 'enrollments',
          id: enrollment.id,
          data: {
            status: 'expired',
            processedAt: now,
          },
          overrideAccess: true,
        })

        // Revoke the course entitlement
        await revokeCourseEntitlement({
          payload,
          userId: studentId,
          courseId,
          enrollmentId: enrollment.id,
        })

        stats.expiredCount++
        reqLogger.info(
          { enrollmentId: enrollment.id, studentId, courseId },
          '[enrollment-expiry] Expired enrollment',
        )
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        stats.failedUpdates.push(`${enrollment.id}: ${msg}`)
        reqLogger.error(
          { enrollmentId: enrollment.id, error: msg },
          '[enrollment-expiry] Failed to expire enrollment',
        )
      }
    }
  }

  if (stats.failedUpdates.length > 0) {
    return {
      success: false,
      error: `Completed with ${stats.failedUpdates.length} failures`,
      statusCode: 207,
    }
  }

  return {
    success: true,
    data: { expiredCount: stats.expiredCount },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PayloadType = any

export const enrollmentExpiryEndpoint: Endpoint = {
  path: '/cron/enrollment-expiry',
  method: 'post',
  handler: withCronMiddleware(async ({ reqLogger, payload }: { reqLogger: any; payload: PayloadType }) => {
    return expireEnrollments(payload, reqLogger)
  }),
}

/**
 * Enrollment Lifecycle Hook
 *
 * @fileType hook
 * @domain lms
 * @pattern enrollment, entitlement
 * @ai-summary Automatically grants or revokes course entitlements when enrollment status changes
 */

import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { grantCourseEntitlement, revokeCourseEntitlement } from '@/server/services/enrollment-grant'
import { logger } from '@/infra/utils/logger'

/**
 * After enrollment is created/updated — grant or revoke entitlements based on status.
 *
 * - approved → grant entitlement
 * - rejected/cancelled/expired → revoke entitlement
 * - pending → no action
 */
export const manageEntitlementsOnChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  const enrollment = doc as {
    id: string
    student?: string | { id: string }
    course?: string | { id: string }
    status?: string
    grantMethod?: string
    expiresAt?: string | null
  }

  const studentId =
    typeof enrollment.student === 'string' ? enrollment.student : enrollment.student?.id
  const courseId = typeof enrollment.course === 'string' ? enrollment.course : enrollment.course?.id

  if (!studentId || !courseId) {
    return doc
  }

  const status = enrollment.status
  const enrollmentId = enrollment.id

  // Only act on status changes (not on every update)
  const previousStatus = previousDoc?.status as string | undefined

  if (status === 'approved') {
    // Map enrollment grantMethod to Payload's accepted values.
    // 'request' is mapped to 'admin' since it's not in Payload's grantMethod enum.
    const rawMethod = enrollment.grantMethod as string | undefined
    const mappedGrantMethod: 'admin' | 'payment' | 'code' =
      rawMethod === 'payment' ? 'payment' : rawMethod === 'code' ? 'code' : 'admin'

    // Grant entitlement on approval
    const result = await grantCourseEntitlement({
      payload: req.payload,
      userId: studentId,
      courseId,
      grantMethod: mappedGrantMethod,
      expiresAt: enrollment.expiresAt ?? null,
      enrollmentId,
    })

    if (result.granted) {
      logger.info(
        { enrollmentId, studentId, courseId },
        '[enrollment] Entitlement granted after approval',
      )
    }
  } else if (
    previousStatus === 'approved' &&
    status &&
    ['rejected', 'cancelled', 'expired', 'pending'].includes(status)
  ) {
    // Revoke entitlement when status changes away from approved
    const result = await revokeCourseEntitlement({
      payload: req.payload,
      userId: studentId,
      courseId,
      enrollmentId,
    })

    if (result.revoked) {
      logger.info(
        { enrollmentId, studentId, courseId, newStatus: status },
        '[enrollment] Entitlement revoked after status change',
      )
    }
  }

  return doc
}

/**
 * After enrollment is deleted — revoke entitlement if it was approved.
 */
export const revokeEntitlementOnDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const enrollment = doc as {
    id: string
    student?: string | { id: string }
    course?: string | { id: string }
    status?: string
  }

  const studentId =
    typeof enrollment.student === 'string' ? enrollment.student : enrollment.student?.id
  const courseId = typeof enrollment.course === 'string' ? enrollment.course : enrollment.course?.id

  if (!studentId || !courseId) {
    return doc
  }

  // Only revoke if enrollment was in approved status
  if (enrollment.status !== 'approved') {
    return doc
  }

  const result = await revokeCourseEntitlement({
    payload: req.payload,
    userId: studentId,
    courseId,
    enrollmentId: enrollment.id,
  })

  if (result.revoked) {
    logger.info(
      { enrollmentId: enrollment.id, studentId, courseId },
      '[enrollment] Entitlement revoked after enrollment deletion',
    )
  }

  return doc
}

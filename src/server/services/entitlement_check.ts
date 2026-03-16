/**
 * Entitlement check service
 *
 * @fileType service
 * @domain entitlements
 * @ai-summary Checks if a user has access to a paid course via courseEntitlements array on User
 */

import type { Payload } from 'payload'

interface CheckEntitlementParams {
  payload: Payload
  userId: string
  courseId: string
}

/**
 * Check if a user has an entitlement for a course.
 * Course entitlement covers all lessons in that course.
 */
export async function hasEntitlement({
  payload,
  userId,
  courseId,
}: CheckEntitlementParams): Promise<boolean> {
  const user = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
    select: { courseEntitlements: true },
  })

  const entitlements = user?.courseEntitlements
  if (!entitlements || entitlements.length === 0) return false

  return entitlements.some((e) => {
    const entCourseId = typeof e.course === 'string' ? e.course : e.course?.id
    return entCourseId === courseId
  })
}

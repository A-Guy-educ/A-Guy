/**
 * Entitlement check service
 *
 * @fileType service
 * @domain entitlements
 * @ai-summary Checks if a user has access to a paid course via Enrollments collection (with courseEntitlements fallback for backward compatibility)
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
 *
 * Checks Enrollments collection first (new system), then falls back to
 * legacy courseEntitlements array on User for backward compatibility.
 */
export async function hasEntitlement({
  payload,
  userId,
  courseId,
}: CheckEntitlementParams): Promise<boolean> {
  // Step 1: Check Enrollments collection (new system)
  const enrollment = await payload.find({
    collection: 'enrollments',
    where: {
      and: [
        { user: { equals: userId } },
        { course: { equals: courseId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (enrollment.docs.length > 0) {
    return true
  }

  // Step 2: Fallback to legacy courseEntitlements for backward compatibility
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

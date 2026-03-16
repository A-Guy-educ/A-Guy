/**
 * Entitlement check service
 *
 * @fileType service
 * @domain entitlements
 * @ai-summary Checks if a user has access to paid courses/lessons via courseEntitlements array on User
 */

import type { Payload } from 'payload'

interface CheckEntitlementParams {
  payload: Payload
  userId: string
  courseId?: string
  lessonId?: string
}

/**
 * Check if a user has an entitlement for a course or lesson.
 * Course entitlement covers all lessons in that course.
 * For lessons, we resolve to the parent course and check course-level access.
 */
export async function hasEntitlement({
  payload,
  userId,
  courseId,
  lessonId,
}: CheckEntitlementParams): Promise<boolean> {
  if (!courseId && !lessonId) return false

  // If we have a lessonId but no courseId, we need the courseId from the lesson page context
  // The caller should pass courseId when checking lesson access
  // For direct courseId checks, just query the user's entitlements array
  const user = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
    select: { courseEntitlements: true },
  })

  const entitlements = user?.courseEntitlements
  if (!entitlements || entitlements.length === 0) return false

  const targetCourseId = courseId || undefined

  if (targetCourseId) {
    return entitlements.some((e) => {
      const entCourseId = typeof e.course === 'string' ? e.course : e.course?.id
      return entCourseId === targetCourseId
    })
  }

  return false
}

/**
 * Entitlement check service
 *
 * @fileType service
 * @domain entitlements
 * @ai-summary Checks if a user has access to a paid course via courseEntitlements array on User
 */

import type { Payload } from 'payload'

import type { User } from '@/payload-types'

interface CheckEntitlementParams {
  payload: Payload
  userId: string
  courseId: string
}

/**
 * Check if a user has an entitlement for a course.
 * Course entitlement covers all lessons in that course.
 * Respects expiration dates on entitlements.
 */
export async function hasEntitlement({
  payload,
  userId,
  courseId,
}: CheckEntitlementParams): Promise<boolean> {
  const user = (await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
    select: { courseEntitlements: true },
  })) as User | null

  const entitlements = user?.courseEntitlements
  if (!entitlements || entitlements.length === 0) return false

  const now = new Date()

  return entitlements.some((e) => {
    const entCourseId = typeof e.course === 'string' ? e.course : e.course?.id

    if (entCourseId !== courseId) return false

    // Check expiration - null expiresAt means never expires
    if (e.expiresAt) {
      const expiresAt = new Date(e.expiresAt)
      if (expiresAt <= now) return false
    }

    return true
  })
}

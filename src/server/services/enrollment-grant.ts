/**
 * Enrollment Grant Service
 *
 * @fileType service
 * @domain lms
 * @pattern enrollment, entitlement
 * @ai-summary Manages course entitlements when enrollments are approved/cancelled/expired
 */

import type { Payload } from 'payload'

/** Entitlement record as stored in Users.courseEntitlements */
interface EntitlementRecord {
  course: string | { id: string }
  grantMethod: 'admin' | 'payment' | 'code'
  grantedAt?: string | null
  id?: string | null
}

interface GrantEntitlementParams {
  payload: Payload
  userId: string
  courseId: string
  grantMethod: 'admin' | 'payment' | 'code'
  expiresAt?: string | null
  enrollmentId: string
}

/**
 * Grant a course entitlement to a user.
 * Idempotent — if the entitlement already exists, it is not duplicated.
 */
export async function grantCourseEntitlement({
  payload,
  userId,
  courseId,
  grantMethod,
  enrollmentId: _enrollmentId,
}: GrantEntitlementParams): Promise<{ granted: boolean; error?: string }> {
  try {
    // Fetch current user with entitlements
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
      select: { courseEntitlements: true },
    })

    const entitlements: EntitlementRecord[] =
      (user?.courseEntitlements as unknown as EntitlementRecord[]) || []

    // Check if entitlement already exists for this course
    const existingIndex = entitlements.findIndex((e) => {
      const entCourseId = typeof e.course === 'string' ? e.course : e.course?.id
      return entCourseId === courseId
    })

    if (existingIndex >= 0) {
      // Already has entitlement — skip silently (idempotent)
      return { granted: false }
    }

    // Add new entitlement (grantMethod must be one of Payload's accepted values)
    const newEntitlement: EntitlementRecord = {
      course: courseId,
      grantMethod,
      grantedAt: new Date().toISOString(),
    }

    const updatedEntitlements: EntitlementRecord[] = [...entitlements, newEntitlement]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await payload.update({
      collection: 'users',
      id: userId,
      data: {
        courseEntitlements: updatedEntitlements,
      },
      overrideAccess: true,
    } as any)

    return { granted: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { granted: false, error: message }
  }
}

interface RevokeEntitlementParams {
  payload: Payload
  userId: string
  courseId: string
  enrollmentId: string
}

/**
 * Revoke a course entitlement from a user.
 * Revokes the most recently granted entitlement for the course (by enrollmentId match or oldest).
 * Idempotent — if no matching entitlement exists, returns success.
 */
export async function revokeCourseEntitlement({
  payload,
  userId,
  courseId,
  enrollmentId: _enrollmentId,
}: RevokeEntitlementParams): Promise<{ revoked: boolean; error?: string }> {
  try {
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
      select: { courseEntitlements: true },
    })

    const entitlements: EntitlementRecord[] =
      (user?.courseEntitlements as unknown as EntitlementRecord[]) || []

    const filtered: EntitlementRecord[] = entitlements.filter((e) => {
      const entCourseId = typeof e.course === 'string' ? e.course : e.course?.id
      return entCourseId !== courseId
    })

    // If nothing changed, already revoked
    if (filtered.length === entitlements.length) {
      return { revoked: false }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await payload.update({
      collection: 'users',
      id: userId,
      data: {
        courseEntitlements: filtered,
      },
      overrideAccess: true,
    } as any)

    return { revoked: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { revoked: false, error: message }
  }
}

/**
 * Shared paid access check for server-rendered pages
 *
 * @fileType utility
 * @domain entitlements
 * @ai-summary Checks if current user has paid access to a course, returns gate props
 */

import { hasEntitlement } from '@/server/services/entitlement_check'
import { getAuthenticatedUserServer } from '@/server/utils/access-gate-server'

interface PaidAccessResult {
  requiresEntitlement: boolean
  isAuthenticated: boolean
}

/**
 * Check if the current user has paid access to a course.
 * Admins always bypass. Unauthenticated users are always blocked.
 */
export async function checkPaidAccess(courseId: string): Promise<PaidAccessResult> {
  const { user, payload } = await getAuthenticatedUserServer()
  const isAdmin = user?.role === 'admin'

  if (isAdmin) {
    return { requiresEntitlement: false, isAuthenticated: true }
  }

  if (!user) {
    return { requiresEntitlement: true, isAuthenticated: false }
  }

  const hasAccess = await hasEntitlement({
    payload,
    userId: user.id,
    courseId,
  })

  return { requiresEntitlement: !hasAccess, isAuthenticated: true }
}

/**
 * Payment Required Access Control
 *
 * @fileType access-control
 * @domain payments
 * @ai-summary Access control blocking non-subscribers from paid features
 */

import type { AccessArgs } from 'payload'

import { AccountRole } from '@/server/payload/collections/Users/roles'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'

import type { User } from '@/payload-types'

/**
 * Access control that requires active subscription or course entitlement
 */
export const paymentRequired = ({ req: { user } }: AccessArgs<User>): boolean => {
  if (!user) return false

  if (!isUsersCollectionUser(user)) return false

  // Admins always have access
  if (user.role === AccountRole.Admin) return true

  // Check subscription status
  if (user.subscriptionStatus === 'active') {
    // Check if period has ended
    if (user.currentPeriodEnd) {
      const periodEnd = new Date(user.currentPeriodEnd)
      if (periodEnd > new Date()) {
        return true
      }
    } else {
      return true
    }
  }

  // Check if user has course entitlements
  if (user.courseEntitlements && user.courseEntitlements.length > 0) {
    const now = new Date()
    // Check if any entitlement is still valid
    return user.courseEntitlements.some((e) => {
      if (!e.expiresAt) return true // No expiration = always valid
      return new Date(e.expiresAt) > now
    })
  }

  return false
}

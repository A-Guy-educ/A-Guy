/**
 * Coupons After Read Hook
 *
 * Computes derived display fields for the admin list view:
 * - status: Active / Expired / Exhausted / Inactive
 * - usageDisplay: "12 / 100" or "12 / ∞"
 * - expiresDisplay: relative time like "in 3 days" or "expired 2 weeks ago"
 *
 * @fileType hook
 * @domain payments
 * @pattern coupon
 * @ai-summary Computes derived coupon list-display fields for admin UI
 */

import type { FieldHookArgs } from 'payload'

type CouponDoc = {
  isActive?: boolean
  validUntil?: string | null
  validFrom?: string | null
  usesCount?: number
  maxUses?: number
}

/**
 * Compute status label from coupon state
 */
export function computeCouponStatus(doc: CouponDoc): string {
  if (!doc) return ''
  if (!doc.isActive) return 'Inactive'
  if ((doc.maxUses ?? 0) > 0 && (doc.usesCount ?? 0) >= (doc.maxUses ?? 0)) return 'Exhausted'
  if (doc.validUntil) {
    const now = new Date()
    const until = new Date(doc.validUntil)
    if (until < now) return 'Expired'
  }
  if (doc.validFrom) {
    const now = new Date()
    const from = new Date(doc.validFrom)
    if (from > now) return 'Scheduled'
  }
  return 'Active'
}

/**
 * Compute usage display string
 */
export function computeUsageDisplay(doc: CouponDoc): string {
  if (!doc) return ''
  const used = doc.usesCount ?? 0
  const max = doc.maxUses ?? 0
  if (max === 0) return `${used} / ∞`
  return `${used} / ${max}`
}

/**
 * Compute relative expiration string
 */
export function computeExpiresDisplay(doc: CouponDoc): string {
  if (!doc) return ''
  if (!doc.validUntil) return 'Never expires'

  const now = new Date()
  const until = new Date(doc.validUntil)
  const diffMs = until.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Expires today'
  if (diffDays === 1) return 'Expires tomorrow'
  if (diffDays === -1) return 'Expired yesterday'
  if (diffDays > 1) return `Expires in ${diffDays} days`
  return `Expired ${Math.abs(diffDays)} days ago`
}

/**
 * afterRead hook for the status field
 */
export const afterReadCouponStatus = async ({ siblingData }: FieldHookArgs) => {
  return computeCouponStatus(siblingData as CouponDoc)
}

/**
 * afterRead hook for the usageDisplay field
 */
export const afterReadCouponUsageDisplay = async ({ siblingData }: FieldHookArgs) => {
  return computeUsageDisplay(siblingData as CouponDoc)
}

/**
 * afterRead hook for the expiresDisplay field
 */
export const afterReadCouponExpiresDisplay = async ({ siblingData }: FieldHookArgs) => {
  return computeExpiresDisplay(siblingData as CouponDoc)
}

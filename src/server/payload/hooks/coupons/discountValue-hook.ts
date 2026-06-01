/**
 * Coupon DiscountValue AfterRead Hook
 *
 * Converts stored agorot → shekels for fixed coupons so the admin UI
 * displays the value the admin typed (not 100× larger).
 *
 * @fileType hook
 * @domain payments
 * @pattern coupon
 */

import type { FieldHookArgs } from 'payload'

/**
 * afterRead hook for discountValue field.
 *
 * For fixed coupons, the stored value is in agorot (×100 shekels).
 * We divide by 100 so the admin sees the shekel value they entered.
 * For percentage coupons, the value is stored as-is (0–100).
 */
export const afterReadDiscountValue = async ({ siblingData, value }: FieldHookArgs) => {
  if (typeof value !== 'number') return value

  if (siblingData?.discountType === 'fixed') {
    // Stored in agorot; convert back to shekels for admin display
    return Math.round(value / 100)
  }

  // Percentage — stored as-is
  return value
}

/**
 * Compute a human-readable discount display string for list views.
 *
 * Fixed: "₪30.00"
 * Percentage: "30%"
 */
export function computeDiscountDisplay(
  discountType: string | undefined,
  discountValue: number | undefined,
): string {
  if (discountType === 'fixed' && typeof discountValue === 'number') {
    const shekels = discountValue / 100
    return `₪${shekels.toFixed(2)}`
  }
  if (discountType === 'percentage' && typeof discountValue === 'number') {
    return `${discountValue}%`
  }
  return ''
}

/**
 * afterRead hook for the discountDisplay virtual field.
 */
export const afterReadCouponDiscountDisplay = async ({ siblingData }: FieldHookArgs) => {
  return computeDiscountDisplay(
    siblingData?.discountType as string | undefined,
    siblingData?.discountValue as number | undefined,
  )
}

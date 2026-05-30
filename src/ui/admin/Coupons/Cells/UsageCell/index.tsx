/**
 * CouponUsageCell — usage display for the Coupons list view.
 *
 * Shows "used / max" or "used / ∞" for unlimited coupons.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Shows usage count display for coupon list view
 */

'use client'

import React from 'react'

interface CouponUsageCellProps {
  cellData?: string
  fieldData?: string
}

export const CouponUsageCell: React.FC<CouponUsageCellProps> = ({
  cellData,
  fieldData,
}: CouponUsageCellProps) => {
  const display = cellData || fieldData || '0 / ∞'

  return <span className="text-label font-mono text-foreground">{display}</span>
}

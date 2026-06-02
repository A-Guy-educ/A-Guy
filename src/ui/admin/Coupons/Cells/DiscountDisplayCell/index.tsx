/**
 * CouponDiscountDisplayCell — shows formatted discount for list view scanning.
 *
 * Fixed: "₪30.00"   Percentage: "30%"
 *
 * @fileType component
 * @domain admin
 * @ai-summary Displays human-readable discount value in list view
 */

'use client'

import React from 'react'

interface CouponDiscountDisplayCellProps {
  cellData?: string
  fieldData?: string
}

export const CouponDiscountDisplayCell: React.FC<CouponDiscountDisplayCellProps> = ({
  cellData,
  fieldData,
}) => {
  const value = cellData || fieldData || '—'

  return <span className="font-mono text-body-sm text-card-foreground font-medium">{value}</span>
}

/**
 * CouponStatusCell — color-coded status badge for the Coupons list view.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Shows color badge for coupon status (Active / Expired / Exhausted / Inactive / Scheduled)
 */

'use client'

import React from 'react'
import { useTranslation } from '@payloadcms/ui'
import { getCouponStrings } from '../../strings'

type CouponStatus = 'Active' | 'Expired' | 'Exhausted' | 'Inactive' | 'Scheduled'

const STATUS_CONFIG: Record<CouponStatus, { classes: string }> = {
  Active: {
    classes: 'bg-success/15 text-success border border-success/30',
  },
  Expired: {
    classes: 'bg-destructive/15 text-destructive border border-destructive/30',
  },
  Exhausted: {
    classes: 'bg-warning/15 text-warning border border-warning/30',
  },
  Inactive: {
    classes: 'bg-muted text-muted-foreground border border-muted',
  },
  Scheduled: {
    classes: 'bg-primary/15 text-primary border border-primary/30',
  },
}

interface CouponStatusCellProps {
  cellData?: string
  fieldData?: CouponStatus
}

export const CouponStatusCell: React.FC<CouponStatusCellProps> = ({
  cellData,
  fieldData,
}: CouponStatusCellProps) => {
  const { i18n } = useTranslation()
  const s = getCouponStrings(i18n.language)
  const status = (cellData || fieldData || 'Inactive') as CouponStatus
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.Inactive

  // Get localized label
  const label =
    status === 'Active'
      ? s.statusActive
      : status === 'Expired'
        ? s.statusExpired
        : status === 'Exhausted'
          ? s.statusExhausted
          : status === 'Inactive'
            ? s.statusInactive
            : s.statusScheduled

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label font-semibold ${config.classes}`}
    >
      {label}
    </span>
  )
}

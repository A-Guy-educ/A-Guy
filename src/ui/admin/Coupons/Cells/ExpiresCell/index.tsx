/**
 * CouponExpiresCell — relative expiration display for the Coupons list view.
 *
 * Shows relative time like "in 3 days", "expired 2 weeks ago", or "Never expires".
 *
 * @fileType component
 * @domain admin
 * @ai-summary Shows relative expiration string for coupon list view
 */

'use client'

import React from 'react'
import { useTranslation } from '@payloadcms/ui'
import { getCouponStrings } from '../../strings'

interface CouponExpiresCellProps {
  cellData?: string
  fieldData?: string
}

export const CouponExpiresCell: React.FC<CouponExpiresCellProps> = ({
  cellData,
  fieldData,
}: CouponExpiresCellProps) => {
  const { i18n } = useTranslation()
  const s = getCouponStrings(i18n.language)
  const display = cellData || fieldData || s.expiresNever

  // Color coding based on expiration status
  const isExpired = display.startsWith('Expired') || display.includes('נוצל')
  const isExpiringSoon =
    display.includes('tomorrow') ||
    display.includes('today') ||
    display.includes('מחר') ||
    display.includes('היום')
  const neverExpires = display === s.expiresNever

  let colorClass = 'text-foreground'
  if (isExpired) colorClass = 'text-destructive'
  else if (isExpiringSoon) colorClass = 'text-warning'
  else if (neverExpires) colorClass = 'text-muted-foreground'

  return <span className={`text-label ${colorClass}`}>{display}</span>
}

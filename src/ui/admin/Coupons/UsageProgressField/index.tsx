/**
 * CouponUsageProgress — usage progress bar for the coupon detail view.
 *
 * Shows a progress bar when maxUses > 0, with absolute counts beside it.
 * Displays only when the coupon has a usage limit.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Shows usage progress bar on coupon detail view
 */

'use client'

import React from 'react'
import { useFormFields, useTranslation } from '@payloadcms/ui'
import { Progress } from '@/ui/web/components/progress'
import { getCouponStrings } from '../strings'

export const CouponUsageProgress: React.FC = () => {
  const { i18n } = useTranslation()
  const s = getCouponStrings(i18n.language)

  // Read usesCount and maxUses from form fields
  const usesCountField = useFormFields(([fields]) => fields.usesCount)
  const maxUsesField = useFormFields(([fields]) => fields.maxUses)

  const usesCount = (usesCountField?.value as number) ?? 0
  const maxUses = (maxUsesField?.value as number) ?? 0

  // Only show when maxUses > 0 (coupon has a usage limit)
  if (maxUses <= 0) {
    return null
  }

  const percentage = Math.min(100, Math.round((usesCount / maxUses) * 100))
  const isExhausted = usesCount >= maxUses

  return (
    <div className="space-y-2 p-card-padding-sm border border-border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <span className="text-label font-semibold text-foreground">{s.usageProgress}</span>
        <span
          className={`text-label font-mono ${isExhausted ? 'text-destructive' : 'text-foreground'}`}
        >
          {usesCount} / {maxUses}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
      <div className="flex justify-between text-label text-muted-foreground">
        <span>{percentage}%</span>
        {isExhausted ? (
          <span className="text-destructive font-semibold">{s.usageExhausted}</span>
        ) : (
          <span>
            {maxUses - usesCount} {s.usageRemaining}
          </span>
        )}
      </div>
    </div>
  )
}

'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'

interface ContentStatusBadgeProps {
  contentStatus?: 'none' | 'soon' | 'justAdded' | 'custom' | null
  contentStatusExpiresAt?: string | null
  contentStatusLabel?: string | null
  className?: string
}

/**
 * Content Status Badge component
 *
 * Displays a pill-shaped badge indicating content status:
 * - "Soon": Neutral gray styling, locked content
 * - "Just Added": Green styling with pulse animation, accessible content
 * - "Custom": Accent styling with admin-defined label text
 *
 * Returns null for 'none', null/undefined status, or expired 'justAdded' badges
 */
export function ContentStatusBadge({
  contentStatus,
  contentStatusExpiresAt,
  contentStatusLabel,
  className,
}: ContentStatusBadgeProps) {
  const t = useTranslations('courses')

  // Return nothing for 'none', null, or undefined
  if (!contentStatus || contentStatus === 'none') {
    return null
  }

  // Check if "Just Added" has expired
  if (contentStatus === 'justAdded' && contentStatusExpiresAt) {
    const expiryDate = new Date(contentStatusExpiresAt)
    const now = new Date()
    if (expiryDate < now) {
      return null
    }
  }

  // "Soon" badge - neutral gray styling
  if (contentStatus === 'soon') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-body-xs font-bold',
          'bg-muted text-muted-foreground',
          className,
        )}
      >
        {t('soonBadge')}
      </span>
    )
  }

  // "Just Added" badge - green styling with pulse animation
  if (contentStatus === 'justAdded') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-body-xs font-bold',
          'bg-emerald-500 text-white animate-pulse',
          className,
        )}
      >
        {t('justAddedBadge')}
      </span>
    )
  }

  // "Custom" badge - accent styling with admin-defined label
  if (contentStatus === 'custom' && contentStatusLabel) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-body-xs font-bold',
          'bg-secondary text-secondary-foreground',
          className,
        )}
      >
        {contentStatusLabel}
      </span>
    )
  }

  return null
}

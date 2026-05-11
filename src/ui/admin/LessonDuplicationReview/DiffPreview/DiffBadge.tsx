/**
 * DiffBadge — color-coded badge for diff classification.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Shows the type of difference between source and variation blocks.
 */
import type { DiffCategory } from '@/ui/admin/LessonDuplicationReview/lib/diff'

const BADGE_STYLES: Record<DiffCategory, { label: string; classes: string }> = {
  identical: {
    label: 'Identical',
    classes:
      'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.3)]',
  },
  numeric_only: {
    label: 'Numeric only',
    classes:
      'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))] border border-[hsl(var(--warning)/0.3)]',
  },
  phrasing_changed: {
    label: 'Phrasing changed',
    classes:
      'bg-[hsl(var(--badge-orange)/0.15)] text-[hsl(var(--badge-orange))] border border-[hsl(var(--badge-orange)/0.3)]',
  },
  structural_diff: {
    label: 'Structural diff',
    classes:
      'bg-[hsl(var(--error)/0.15)] text-[hsl(var(--error))] border border-[hsl(var(--error)/0.3)]',
  },
}

interface DiffBadgeProps {
  category: DiffCategory
}

export function DiffBadge({ category }: DiffBadgeProps) {
  const { label, classes } = BADGE_STYLES[category]
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label font-semibold ${classes}`}
    >
      {label}
    </span>
  )
}

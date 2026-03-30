import { cn } from '@/infra/utils/ui'
import * as React from 'react'

type AccentPosition = 'start' | 'top'

interface AccentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Accent color for the border (CSS color string) */
  accentColor?: string
  /** Position of the accent bar */
  accentPosition?: AccentPosition
  /** Whether the card is in a disabled/locked state */
  disabled?: boolean
  ref?: React.Ref<HTMLDivElement>
}

/**
 * Card with a colored accent bar (top or inline-start).
 *
 * Provides consistent styling: rounded-xl, subtle border, 3px accent bar,
 * tactile hover/active states. Used for lesson cards, stats cards, etc.
 */
const AccentCard: React.FC<AccentCardProps> = ({
  className,
  accentColor = 'hsl(var(--primary))',
  accentPosition = 'start',
  disabled = false,
  style,
  ref,
  ...props
}) => {
  const borderColor = disabled ? 'var(--border)' : accentColor
  const accentStyles: React.CSSProperties =
    accentPosition === 'top'
      ? { borderTopWidth: '3px', borderTopColor: borderColor }
      : { borderInlineStartWidth: '3px', borderInlineStartColor: borderColor }

  return (
    <div
      className={cn(
        'relative group rounded-xl bg-card border border-border/30 transition-all duration-normal will-change-transform',
        !disabled && 'hover:border-border/50 active:scale-[0.98]',
        disabled && 'opacity-50',
        className,
      )}
      style={{ ...accentStyles, ...style }}
      ref={ref}
      {...props}
    />
  )
}

export { AccentCard }
export type { AccentCardProps, AccentPosition }

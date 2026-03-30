import { cn } from '@/infra/utils/ui'
import type { LucideIcon } from 'lucide-react'
import * as React from 'react'

interface IconBadgeProps {
  /** The Lucide icon component to render */
  icon: LucideIcon
  /** Accent color (CSS color string) for background tint and icon */
  color?: string
  /** Badge size variant */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: { badge: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4' },
  md: { badge: 'w-12 h-12 rounded-xl', icon: 'w-5 h-5' },
  lg: { badge: 'w-14 h-14 rounded-xl', icon: 'w-7 h-7' },
} as const

/**
 * Colored icon container with a tinted background.
 *
 * Renders a rounded badge with 15% opacity accent color background
 * and the icon in full accent color. Used in lesson cards, stats cards, etc.
 */
const IconBadge: React.FC<IconBadgeProps> = ({
  icon: Icon,
  color = 'hsl(var(--primary))',
  size = 'md',
  className,
}) => {
  const s = SIZES[size]
  return (
    <div
      className={cn(s.badge, 'flex items-center justify-center shrink-0', className)}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      <Icon className={s.icon} style={{ color }} />
    </div>
  )
}

export { IconBadge }
export type { IconBadgeProps }

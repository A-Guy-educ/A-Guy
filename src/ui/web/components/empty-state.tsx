import { cn } from '@/infra/utils/ui'
import type { LucideIcon } from 'lucide-react'
import * as React from 'react'

interface EmptyStateProps {
  /** The Lucide icon to display */
  icon: LucideIcon
  /** Main message */
  title: string
  /** Optional secondary message */
  subtitle?: string
  /** Optional action element (button, link) */
  action?: React.ReactNode
  className?: string
}

/**
 * Empty state placeholder with icon, title, and optional subtitle/action.
 *
 * Used when a list or section has no content to display.
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  subtitle,
  action,
  className,
}) => (
  <div className={cn('text-center py-16', className)}>
    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
      <Icon className="w-8 h-8 text-muted-foreground/50" />
    </div>
    <p className="text-body-lg font-medium text-muted-foreground">{title}</p>
    {subtitle && <p className="text-body-sm text-muted-foreground/60 mt-1">{subtitle}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
)

export { EmptyState }
export type { EmptyStateProps }

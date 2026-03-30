import { cn } from '@/infra/utils/ui'
import * as React from 'react'

interface FooterActionsProps {
  children: React.ReactNode
  className?: string
}

/**
 * Compact footer action bar with centered inline buttons.
 *
 * Renders a top border divider and horizontally centered button group.
 * Children should be links/buttons — use `FooterAction` for consistent styling.
 */
const FooterActions: React.FC<FooterActionsProps> = ({ children, className }) => (
  <div className={cn('mt-8 pt-5 border-t border-border/30', className)}>
    <div className="flex items-center justify-center gap-3 flex-wrap">{children}</div>
  </div>
)

const footerActionBase =
  'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-body-sm font-medium transition-all min-h-[44px] active:opacity-70'

const footerActionVariants = {
  secondary: `${footerActionBase} border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60`,
  primary: `${footerActionBase} bg-primary text-primary-foreground hover:opacity-90`,
} as const

export { FooterActions, footerActionBase, footerActionVariants }
export type { FooterActionsProps }

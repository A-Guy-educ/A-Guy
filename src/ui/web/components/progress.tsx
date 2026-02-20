import * as React from 'react'
import { cn } from '@/infra/utils/ui'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => (
    <div ref={ref} className={cn('relative w-full overflow-hidden bg-muted', className)} {...props}>
      <div
        className="h-full bg-primary transition-all duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  ),
)
Progress.displayName = 'Progress'

export { Progress }

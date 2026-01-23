import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/infra/utils/ui'

/**
 * Spinner component for loading states.
 *
 * @example
 * ```tsx
 * <Spinner size="md" />
 * <Spinner size="lg" variant="primary" />
 * ```
 */

const spinnerVariants = cva(
  'inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent',
  {
    variants: {
      size: {
        xs: 'h-3 w-3',
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12',
      },
      variant: {
        default: 'text-foreground',
        muted: 'text-muted-foreground',
        primary: 'text-primary',
        secondary: 'text-secondary-foreground',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
    },
  },
)

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof spinnerVariants> {
  /**
   * Spinner size
   */
  size?: VariantProps<typeof spinnerVariants>['size']

  /**
   * Color variant
   */
  variant?: VariantProps<typeof spinnerVariants>['variant']

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Accessible label for screen readers
   */
  'aria-label'?: string
}

/**
 * Animated spinner component for loading states.
 * Provides consistent sizing and color variants.
 */
export function Spinner({
  size,
  variant,
  className,
  'aria-label': ariaLabel = 'Loading',
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={cn(spinnerVariants({ size, variant }), className)}
      {...props}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  )
}

Spinner.displayName = 'Spinner'

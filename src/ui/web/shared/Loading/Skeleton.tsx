import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/infra/utils/ui'

/**
 * Skeleton component for loading states.
 *
 * @example
 * ```tsx
 * <Skeleton className="h-12 w-full" />
 * <Skeleton variant="circular" className="h-12 w-12" />
 * <Skeleton variant="text" className="w-3/4" />
 * ```
 */

const skeletonVariants = cva('animate-pulse bg-muted', {
  variants: {
    variant: {
      default: 'rounded-md',
      circular: 'rounded-full',
      text: 'rounded-sm h-4',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof skeletonVariants> {
  /**
   * Shape variant
   */
  variant?: VariantProps<typeof skeletonVariants>['variant']

  /**
   * Additional CSS classes (use for width and height)
   */
  className?: string
}

/**
 * Skeleton loading placeholder component.
 * Use Tailwind classes to set width and height.
 */
export function Skeleton({ variant, className, ...props }: SkeletonProps) {
  return <div className={cn(skeletonVariants({ variant }), className)} {...props} />
}

Skeleton.displayName = 'Skeleton'

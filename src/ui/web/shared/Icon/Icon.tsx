import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/infra/utils/ui'
import type { LucideIcon } from 'lucide-react'

/**
 * Icon wrapper component for lucide-react icons with consistent sizing.
 *
 * @example
 * ```tsx
 * import { Check, AlertCircle } from 'lucide-react'
 *
 * <Icon icon={Check} size="md" />
 * <Icon icon={AlertCircle} size="lg" variant="error" />
 * ```
 */

const iconVariants = cva('inline-flex shrink-0', {
  variants: {
    size: {
      xs: 'h-3 w-3',
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
      xl: 'h-8 w-8',
      '2xl': 'h-10 w-10',
    },
    variant: {
      default: 'text-foreground',
      muted: 'text-muted-foreground',
      primary: 'text-primary',
      secondary: 'text-secondary-foreground',
      success: 'text-success',
      warning: 'text-warning',
      error: 'text-error',
      destructive: 'text-destructive',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'default',
  },
})

export interface IconProps
  extends Omit<React.SVGProps<SVGSVGElement>, 'ref'>, VariantProps<typeof iconVariants> {
  /**
   * Lucide icon component
   */
  icon: LucideIcon

  /**
   * Icon size
   */
  size?: VariantProps<typeof iconVariants>['size']

  /**
   * Color variant
   */
  variant?: VariantProps<typeof iconVariants>['variant']

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
 * Wrapper component for lucide-react icons with consistent sizing and colors.
 * Provides semantic color variants and size tokens.
 */
export function Icon({
  icon: IconComponent,
  size,
  variant,
  className,
  'aria-label': ariaLabel,
  ...props
}: IconProps) {
  return (
    <IconComponent
      className={cn(iconVariants({ size, variant }), className)}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
      {...props}
    />
  )
}

Icon.displayName = 'Icon'

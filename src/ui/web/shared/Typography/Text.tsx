import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/infra/utils/ui'

/**
 * Text component for body copy with size and color variants.
 *
 * @example
 * ```tsx
 * <Text size="body-lg">Large body text</Text>
 * <Text size="body-sm" variant="muted">Small muted text</Text>
 * <Text as="span" weight="semibold">Inline bold text</Text>
 * ```
 */

const textVariants = cva('font-sans', {
  variants: {
    size: {
      'body-xl': 'text-body-xl',
      'body-lg': 'text-body-lg',
      'body-md': 'text-body-md',
      'body-sm': 'text-body-sm',
      'body-xs': 'text-body-xs',
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
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    align: {
      left: 'text-start',
      center: 'text-center',
      right: 'text-end',
      justify: 'text-justify',
    },
  },
  defaultVariants: {
    size: 'body-md',
    variant: 'default',
    weight: 'normal',
    align: 'left',
  },
})

export interface TextProps
  extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof textVariants> {
  /**
   * HTML element to render
   */
  as?: 'p' | 'span' | 'div' | 'label' | 'small' | 'strong' | 'em'

  /**
   * Text size variant
   */
  size?: VariantProps<typeof textVariants>['size']

  /**
   * Color variant
   */
  variant?: VariantProps<typeof textVariants>['variant']

  /**
   * Font weight
   */
  weight?: VariantProps<typeof textVariants>['weight']

  /**
   * Text alignment
   */
  align?: VariantProps<typeof textVariants>['align']

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Child content
   */
  children: React.ReactNode
}

/**
 * Flexible text component for body copy.
 * Use for paragraphs, labels, and inline text with consistent styling.
 */
export function Text({
  as: Component = 'p',
  size,
  variant,
  weight,
  align,
  className,
  children,
  ...props
}: TextProps) {
  return (
    <Component className={cn(textVariants({ size, variant, weight, align }), className)} {...props}>
      {children}
    </Component>
  )
}

Text.displayName = 'Text'

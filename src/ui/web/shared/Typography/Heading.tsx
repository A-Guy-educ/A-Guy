import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/infra/utils/ui'

/**
 * Heading component with semantic HTML levels and visual size variants.
 *
 * @example
 * ```tsx
 * <Heading level="h1" size="display-xl">Hero Heading</Heading>
 * <Heading level="h2" size="heading-lg">Section Title</Heading>
 * <Heading level="h3">Subsection</Heading>
 * ```
 */

const headingVariants = cva('font-sans', {
  variants: {
    size: {
      // Display sizes (for hero sections, landing pages)
      'display-2xl': 'text-display-2xl',
      'display-xl': 'text-display-xl',
      'display-lg': 'text-display-lg',
      'display-md': 'text-display-md',
      'display-sm': 'text-display-sm',

      // Heading sizes (for content headings)
      'heading-xl': 'text-heading-xl',
      'heading-lg': 'text-heading-lg',
      'heading-md': 'text-heading-md',
      'heading-sm': 'text-heading-sm',
    },
    align: {
      left: 'text-start',
      center: 'text-center',
      right: 'text-end',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
  },
  defaultVariants: {
    size: 'heading-lg',
    align: 'left',
    weight: 'semibold',
  },
})

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>, VariantProps<typeof headingVariants> {
  /**
   * Semantic HTML heading level
   */
  level?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

  /**
   * Visual size variant (independent of semantic level)
   */
  size?: VariantProps<typeof headingVariants>['size']

  /**
   * Text alignment
   */
  align?: VariantProps<typeof headingVariants>['align']

  /**
   * Font weight
   */
  weight?: VariantProps<typeof headingVariants>['weight']

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
 * Heading component that separates semantic HTML level from visual appearance.
 * Use the `level` prop for SEO and accessibility, and `size` for visual design.
 */
export function Heading({
  level = 'h2',
  size,
  align,
  weight,
  className,
  children,
  ...props
}: HeadingProps) {
  const Component = level

  return (
    <Component className={cn(headingVariants({ size, align, weight }), className)} {...props}>
      {children}
    </Component>
  )
}

Heading.displayName = 'Heading'

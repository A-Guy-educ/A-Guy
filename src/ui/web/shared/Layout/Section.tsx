import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/infra/utils/ui'

/**
 * Section component for page sections with consistent vertical padding.
 *
 * @example
 * ```tsx
 * <Section size="md">
 *   <Heading level="h2">Section Title</Heading>
 *   <Text>Section content...</Text>
 * </Section>
 *
 * <Section size="lg" variant="muted">
 *   <Container>
 *     {content}
 *   </Container>
 * </Section>
 * ```
 */

const sectionVariants = cva('w-full', {
  variants: {
    size: {
      xs: 'py-section-xs',
      sm: 'py-section-sm',
      md: 'py-section-md',
      lg: 'py-section-lg',
      xl: 'py-section-xl',
    },
    variant: {
      default: 'bg-background',
      muted: 'bg-muted',
      card: 'bg-card',
      primary: 'bg-primary text-primary-foreground',
      secondary: 'bg-secondary text-secondary-foreground',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'default',
  },
})

export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof sectionVariants> {
  /**
   * Vertical padding size
   */
  size?: VariantProps<typeof sectionVariants>['size']

  /**
   * Background variant
   */
  variant?: VariantProps<typeof sectionVariants>['variant']

  /**
   * HTML element to render
   */
  as?: 'section' | 'div' | 'article' | 'aside' | 'header' | 'footer' | 'main'

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Child elements
   */
  children: React.ReactNode
}

/**
 * Semantic section component for page structure.
 * Provides consistent vertical rhythm and optional background variants.
 */
export function Section({
  size,
  variant,
  as: Component = 'section',
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <Component className={cn(sectionVariants({ size, variant }), className)} {...props}>
      {children}
    </Component>
  )
}

Section.displayName = 'Section'

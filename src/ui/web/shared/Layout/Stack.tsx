import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/infra/utils/ui'

/**
 * Stack component for vertical or horizontal layouts with consistent spacing.
 *
 * @example
 * ```tsx
 * <Stack gap="content-gap">
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 * </Stack>
 *
 * <Stack direction="horizontal" gap="content-gap-sm" align="center">
 *   <Icon />
 *   <Text>Label</Text>
 * </Stack>
 * ```
 */

const stackVariants = cva('flex', {
  variants: {
    direction: {
      vertical: 'flex-col',
      horizontal: 'flex-row',
    },
    gap: {
      // Design token gaps
      'content-gap-xs': 'gap-content-gap-xs',
      'content-gap-sm': 'gap-content-gap-sm',
      'content-gap': 'gap-content-gap',
      'content-gap-lg': 'gap-content-gap-lg',
      'content-gap-xl': 'gap-content-gap-xl',

      // Standard Tailwind gaps
      '0': 'gap-0',
      '1': 'gap-1',
      '2': 'gap-2',
      '3': 'gap-3',
      '4': 'gap-4',
      '6': 'gap-6',
      '8': 'gap-8',
      '12': 'gap-12',
      '16': 'gap-16',
    },
    align: {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      baseline: 'items-baseline',
      stretch: 'items-stretch',
    },
    justify: {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
      evenly: 'justify-evenly',
    },
    wrap: {
      nowrap: 'flex-nowrap',
      wrap: 'flex-wrap',
      'wrap-reverse': 'flex-wrap-reverse',
    },
  },
  defaultVariants: {
    direction: 'vertical',
    gap: 'content-gap',
    align: 'stretch',
    justify: 'start',
    wrap: 'nowrap',
  },
})

export interface StackProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof stackVariants> {
  /**
   * Stack direction
   */
  direction?: VariantProps<typeof stackVariants>['direction']

  /**
   * Gap between items
   */
  gap?: VariantProps<typeof stackVariants>['gap']

  /**
   * Cross-axis alignment
   */
  align?: VariantProps<typeof stackVariants>['align']

  /**
   * Main-axis alignment
   */
  justify?: VariantProps<typeof stackVariants>['justify']

  /**
   * Flex wrap behavior
   */
  wrap?: VariantProps<typeof stackVariants>['wrap']

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
 * Flexible layout component for stacking elements with consistent spacing.
 * Supports both vertical and horizontal layouts with design token gaps.
 */
export function Stack({
  direction,
  gap,
  align,
  justify,
  wrap,
  className,
  children,
  ...props
}: StackProps) {
  return (
    <div
      className={cn(stackVariants({ direction, gap, align, justify, wrap }), className)}
      {...props}
    >
      {children}
    </div>
  )
}

Stack.displayName = 'Stack'

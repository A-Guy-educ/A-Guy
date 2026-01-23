import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utilities/ui'

/**
 * Grid component for responsive grid layouts.
 *
 * @example
 * ```tsx
 * <Grid cols={{ default: 1, md: 2, lg: 3 }} gap="content-gap">
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 *   <div>Item 3</div>
 * </Grid>
 *
 * <Grid cols="4" gap="content-gap-lg">
 *   {items.map(item => <Card key={item.id} {...item} />)}
 * </Grid>
 * ```
 */

const gridVariants = cva('grid', {
  variants: {
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
    cols: {
      '1': 'grid-cols-1',
      '2': 'grid-cols-2',
      '3': 'grid-cols-3',
      '4': 'grid-cols-4',
      '5': 'grid-cols-5',
      '6': 'grid-cols-6',
      '12': 'grid-cols-12',
    },
    align: {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      baseline: 'items-baseline',
      stretch: 'items-stretch',
    },
    justify: {
      start: 'justify-items-start',
      center: 'justify-items-center',
      end: 'justify-items-end',
      stretch: 'justify-items-stretch',
    },
  },
  defaultVariants: {
    gap: 'content-gap',
    cols: '1',
    align: 'stretch',
    justify: 'stretch',
  },
})

export interface ResponsiveCols {
  default?: '1' | '2' | '3' | '4' | '5' | '6' | '12'
  sm?: '1' | '2' | '3' | '4' | '5' | '6' | '12'
  md?: '1' | '2' | '3' | '4' | '5' | '6' | '12'
  lg?: '1' | '2' | '3' | '4' | '5' | '6' | '12'
  xl?: '1' | '2' | '3' | '4' | '5' | '6' | '12'
  '2xl'?: '1' | '2' | '3' | '4' | '5' | '6' | '12'
}

export interface GridProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, 'cols'>,
    Omit<VariantProps<typeof gridVariants>, 'cols'> {
  /**
   * Number of columns (responsive object or single value)
   */
  cols?: '1' | '2' | '3' | '4' | '5' | '6' | '12' | ResponsiveCols

  /**
   * Gap between items
   */
  gap?: VariantProps<typeof gridVariants>['gap']

  /**
   * Cross-axis alignment
   */
  align?: VariantProps<typeof gridVariants>['align']

  /**
   * Main-axis alignment
   */
  justify?: VariantProps<typeof gridVariants>['justify']

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
 * Responsive grid layout component with design token gaps.
 * Supports responsive column configuration via object notation.
 */
export function Grid({
  cols = '1',
  gap,
  align,
  justify,
  className,
  children,
  ...props
}: GridProps) {
  // Handle responsive cols
  const colsClasses =
    typeof cols === 'string'
      ? undefined
      : Object.entries(cols)
          .map(([breakpoint, value]) => {
            if (breakpoint === 'default') return `grid-cols-${value}`
            return `${breakpoint}:grid-cols-${value}`
          })
          .join(' ')

  return (
    <div
      className={cn(
        gridVariants({
          cols: typeof cols === 'string' ? cols : undefined,
          gap,
          align,
          justify,
        }),
        colsClasses,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

Grid.displayName = 'Grid'

/**
 * GraphWithPrompt Layout Wrapper
 *
 * Renders prompt text alongside a graph (geometry or axis) with configurable layout.
 * Supports 4 layout modes: textAbove, textBelow, textLeft, textRight.
 *
 * IMPORTANT: Side-by-side layouts (textLeft, textRight) do NOT use responsive breakpoints
 * in interactive mode (when worksheetLayout is absent). In worksheet mode, responsive
 * breakpoints activate to enforce mobile stacking with prompt-first ordering.
 */

import React from 'react'
import { cn } from '@/infra/utils/ui'
import type { GraphLayout, InlineRichText } from '@/server/payload/collections/Exercises/types'
import { RichTextRenderer } from '../RichTextRenderer'

interface WorksheetLayoutOptions {
  /**
   * Override proportions for worksheet side-by-side mode.
   * '60-40' = prompt/exercise 60%, diagram 40% (capped at ~400px).
   * '50-50' = equal split (interactive default).
   * Default: '60-40'.
   */
  proportions?: '60-40' | '50-50'
  /**
   * Viewport-relative max-width cap for the side-content child.
   * Given as a CSS max-width value (e.g. '25rem' = 400px).
   * Default: '25rem'.
   */
  maxWidthCap?: string
  /**
   * Aspect ratio (width / height) of the side content.
   * When > 5/3 (≈ 1.667), side-by-side switches to stacked layout (3/5 wrap rule
   * — content wider than 5:3 stacks; square or portrait stays side-by-side).
   * Geometry blocks: compute from geometry.canvas.width / geometry.canvas.height.
   */
  sideContentAspectRatio?: number
}

interface GraphWithPromptProps {
  /** Layout mode for positioning prompt relative to graph */
  layout?: GraphLayout
  /** Prompt text to display */
  prompt?: InlineRichText
  /** Unique ID for this block (used for synthetic RichTextRenderer block ID) */
  blockId: string
  /** Child graph renderer (GeometryRenderer or AxisRenderer) */
  children: React.ReactNode
  /** Additional CSS classes */
  className?: string
  /**
   * Worksheet-specific layout overrides.
   * When provided, activates 60/40 proportions, 3/5 wrap rule, and mobile stacking.
   * Interactive tab should NOT pass this prop (leaves side-by-side untouched).
   */
  worksheetLayout?: WorksheetLayoutOptions
}

/**
 * Get container classes based on layout mode.
 * In worksheet mode, side-by-side layouts use sm: breakpoints for mobile stacking.
 */
function getLayoutClasses(layout: GraphLayout, worksheetLayout?: WorksheetLayoutOptions): string {
  const isSideBySide = layout === 'textLeft' || layout === 'textRight'

  // Worksheet mode: apply 3/5 wrap rule
  if (isSideBySide && worksheetLayout) {
    const { sideContentAspectRatio } = worksheetLayout
    const shouldWrap = sideContentAspectRatio !== undefined && sideContentAspectRatio > 5 / 3
    if (shouldWrap) {
      // Wrap: switch to stacked (textBelow/textAbove already handles correct DOM order)
      return 'flex flex-col'
    }
    // Side-by-side with responsive breakpoints for mobile stack
    // sm:flex-row = side-by-side above 640px; flex-col = stacked below 640px
    return 'flex flex-col sm:flex-row'
  }

  // Non-worksheet (interactive tab) — no responsive breakpoints, strict side-by-side
  switch (layout) {
    case 'textAbove':
    case 'textBelow':
      return 'flex flex-col'
    case 'textLeft':
    case 'textRight':
    default:
      return 'flex flex-row'
  }
}

/**
 * GraphWithPrompt Component
 *
 * Renders prompt + graph with configurable layout.
 * - Vertical layouts (textAbove, textBelow): use flex-col
 * - Horizontal layouts (textLeft, textRight): use flex-row WITHOUT responsive breakpoints
 * - Minimum width threshold on graph container for side-by-side layouts
 */
export function GraphWithPrompt({
  layout = 'textRight',
  prompt,
  blockId,
  children,
  className = '',
  worksheetLayout,
}: GraphWithPromptProps) {
  const containerClasses = getLayoutClasses(layout, worksheetLayout)

  // Determine if we should show graph first in DOM for textRight layout
  const showGraphFirst = layout === 'textBelow' || layout === 'textRight'

  // Check if prompt has content
  const hasPrompt = prompt && prompt.value && prompt.value.trim().length > 0

  // For side-by-side layouts
  const isSideBySide = layout === 'textLeft' || layout === 'textRight'
  const gapClass = 'gap-content-gap'

  // Interactive mode (no worksheetLayout): apply min-w floor on graph
  const isWorksheet = Boolean(worksheetLayout)

  // 3/5 wrap: if wrapping, use stacked min-height for both children
  const { sideContentAspectRatio } = worksheetLayout ?? {}
  const shouldWrap = sideContentAspectRatio !== undefined && sideContentAspectRatio > 5 / 3

  // Proportions: 60/40 vs 50/50
  const is60x40 = worksheetLayout?.proportions !== '50-50'
  const maxWidthCap = worksheetLayout?.maxWidthCap ?? '25rem'

  // Child classes
  let promptFlexClass: string
  let graphFlexClass: string

  if (isWorksheet && isSideBySide && !shouldWrap) {
    // Worksheet side-by-side: 60/40 proportions
    promptFlexClass = is60x40 ? 'flex-[3]' : 'flex-1'
    graphFlexClass = is60x40 ? `flex-[2] max-w-[${maxWidthCap}]` : 'flex-1'
  } else if (isSideBySide) {
    // Interactive side-by-side: equal split with min-w floor
    promptFlexClass = 'flex-1'
    graphFlexClass = 'flex-1 min-w-[280px]'
  } else {
    // Vertical layouts
    promptFlexClass = ''
    graphFlexClass = ''
  }

  // Mobile order reversal: for textRight in worksheet mode, graph is first in DOM
  // but needs sm:order-last so prompt appears first on mobile (< 640px)
  const graphOrderClass =
    isWorksheet && layout === 'textRight' && isSideBySide ? 'sm:order-last' : ''

  // Convert InlineRichText to RichTextBlock for RichTextRenderer
  const promptBlock = prompt
    ? {
        type: 'rich_text' as const,
        format: 'md-math-v1' as const,
        value: prompt.value,
        mediaIds: prompt.mediaIds || [],
        id: `${blockId}-prompt`,
      }
    : null

  // For side-by-side layouts, force LTR on the flex container so that
  // "Text Left" / "Text Right" always match the physical visual position
  // regardless of page direction (RTL Hebrew). Text content inside still
  // inherits its own direction from the document.
  const dirProp = isSideBySide ? 'ltr' : undefined

  return (
    <div className={cn('my-4', containerClasses, gapClass, className)} dir={dirProp}>
      {showGraphFirst ? (
        <>
          {/* Graph first (left in horizontal, top in vertical below) */}
          <div className={cn(graphFlexClass, graphOrderClass)} data-testid="graph-child">
            {children}
          </div>
          {/* Prompt second */}
          {hasPrompt && promptBlock && (
            <div
              className={cn(promptFlexClass, !isSideBySide && 'min-h-[60px]')}
              data-testid="prompt-wrapper"
              dir="auto"
            >
              <div className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed">
                <RichTextRenderer block={promptBlock} />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Prompt first (top in vertical above, left in horizontal left) */}
          {hasPrompt && promptBlock && (
            <div
              className={cn(promptFlexClass, !isSideBySide && 'min-h-[60px]')}
              data-testid="prompt-wrapper"
              dir="auto"
            >
              <div className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed">
                <RichTextRenderer block={promptBlock} />
              </div>
            </div>
          )}
          {/* Graph second (right in horizontal, bottom in vertical above) */}
          <div className={cn(graphFlexClass, graphOrderClass)} data-testid="graph-child">
            {children}
          </div>
        </>
      )}
    </div>
  )
}

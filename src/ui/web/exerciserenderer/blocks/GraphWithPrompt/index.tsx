/**
 * GraphWithPrompt Layout Wrapper
 *
 * Renders prompt text alongside a graph (geometry or axis) with configurable layout.
 * Supports 4 layout modes: textAbove, textBelow, textLeft, textRight.
 *
 * IMPORTANT: Side-by-side layouts (textLeft, textRight) do NOT use responsive breakpoints.
 * They remain side-by-side on all screen sizes including mobile/landscape.
 */

import React from 'react'
import { cn } from '@/infra/utils/ui'
import type { GraphLayout, InlineRichText } from '@/server/payload/collections/Exercises/types'
import { RichTextRenderer } from '../RichTextRenderer'

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
}

/**
 * Get container classes based on layout mode
 */
function getLayoutClasses(layout: GraphLayout): string {
  switch (layout) {
    case 'textAbove':
      return 'flex flex-col'
    case 'textBelow':
      return 'flex flex-col'
    case 'textLeft':
      // Side-by-side: prompt left, graph right - NO responsive breakpoints
      return 'flex flex-row'
    case 'textRight':
    default:
      // Side-by-side: graph left, prompt right - NO responsive breakpoints
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
}: GraphWithPromptProps) {
  const containerClasses = getLayoutClasses(layout)

  // Determine if we should show graph first in DOM for textRight layout
  const showGraphFirst = layout === 'textBelow' || layout === 'textRight'

  // Check if prompt has content
  const hasPrompt = prompt && prompt.value && prompt.value.trim().length > 0

  // For side-by-side layouts, add minimum width
  const isSideBySide = layout === 'textLeft' || layout === 'textRight'
  const gapClass = 'gap-content-gap'
  const minWidthClass = isSideBySide ? 'min-w-[280px]' : ''

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
          <div className={cn('flex-1', minWidthClass)} data-testid="graph-child">
            {children}
          </div>
          {/* Prompt second */}
          {hasPrompt && promptBlock && (
            <div
              className={cn('flex-1', !isSideBySide && 'min-h-[60px]')}
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
              className={cn('flex-1', !isSideBySide && 'min-h-[60px]')}
              data-testid="prompt-wrapper"
              dir="auto"
            >
              <div className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed">
                <RichTextRenderer block={promptBlock} />
              </div>
            </div>
          )}
          {/* Graph second (right in horizontal, bottom in vertical above) */}
          <div className={cn('flex-1', minWidthClass)} data-testid="graph-child">
            {children}
          </div>
        </>
      )}
    </div>
  )
}

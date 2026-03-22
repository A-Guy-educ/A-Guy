/**
 * MultiAxisRenderer - Renders multiple axis graphs in a responsive grid layout
 *
 * Supports:
 * - Up to 4 graphs side-by-side
 * - Individual graph labels
 * - Ordering by order field
 * - Explanatory text positioned above or below the graph group
 * - Responsive: 1 col on mobile, 2 cols on tablet, up to 4 on desktop
 */

'use client'

import React, { useMemo } from 'react'
import type { AxisSpecV1 } from '@/infra/contracts'
import { AxisRenderer } from '../AxisRenderer'
import { RichTextRenderer } from '../RichTextRenderer'
import { cn } from '@/infra/utils/ui'

interface MultiAxisGraphItem {
  id: string
  label: string
  axis: AxisSpecV1
  order: number
}

interface MultiAxisRendererProps {
  blockId: string
  graphs: MultiAxisGraphItem[]
  prompt?: {
    type: 'rich_text'
    format: 'md-math-v1'
    value: string
    mediaIds?: string[]
  }
  textPosition: 'above' | 'below'
}

/**
 * Get responsive grid classes based on the number of graphs
 */
function getGridClasses(graphCount: number): string {
  switch (graphCount) {
    case 1:
      // Single graph: full width
      return 'grid-cols-1'
    case 2:
      // Two graphs: 1 col mobile, 2 cols tablet+
      return 'grid-cols-1 sm:grid-cols-2'
    case 3:
      // Three graphs: 1 col mobile, 2 cols tablet, 3 cols desktop
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
    case 4:
    default:
      // Four graphs: 1 col mobile, 2 cols tablet, 4 cols desktop
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  }
}

export function MultiAxisRenderer({
  blockId: _blockId,
  graphs,
  prompt,
  textPosition,
}: MultiAxisRendererProps) {
  // Sort graphs by order field (ascending)
  const sortedGraphs = useMemo(() => [...graphs].sort((a, b) => a.order - b.order), [graphs])

  const gridClasses = getGridClasses(graphs.length)

  // Render prompt text (if exists) above the grid
  const promptAbove =
    prompt && textPosition === 'above' ? (
      <div className="mb-4">
        <RichTextRenderer block={prompt} />
      </div>
    ) : null

  // Render prompt text (if exists) below the grid
  const promptBelow =
    prompt && textPosition === 'below' ? (
      <div className="mt-4">
        <RichTextRenderer block={prompt} />
      </div>
    ) : null

  return (
    <div className="my-4">
      {promptAbove}

      <div className={cn('grid gap-4', gridClasses)}>
        {sortedGraphs.map((graph) => (
          <div key={graph.id} className="flex flex-col">
            {/* Graph label - centered above the graph */}
            <p className="text-center text-sm font-medium text-muted-foreground mb-2">
              {graph.label}
            </p>
            {/* Individual axis renderer */}
            <AxisRenderer blockId={graph.id} spec={graph.axis} />
          </div>
        ))}
      </div>

      {promptBelow}
    </div>
  )
}

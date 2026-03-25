'use client'

import type {
  ContentSlot,
  ContentSlotItem,
  RichContent,
} from '@/server/payload/collections/Exercises/types'
import { isInlineRichText } from '@/server/payload/collections/Exercises/types'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import React, { Suspense } from 'react'
import { MediaAttachments } from '../../components/MediaAttachments'
import { HtmlBlockRenderer } from '../HtmlBlockRenderer'
import { RichTextRenderer } from '../RichTextRenderer'
import { SvgRenderer } from '../SvgRenderer'

// Lazy-loaded components for heavy items
const LazyAxisRenderer = React.lazy(() =>
  import('../AxisRenderer').then((m) => ({ default: m.AxisRenderer })),
)
const LazyGeometryRenderer = React.lazy(() =>
  import('../GeometryRenderer').then((m) => ({ default: m.GeometryRenderer })),
)

interface ContentSlotRendererProps {
  content: RichContent
  /** Additional CSS class for container */
  className?: string
}

/**
 * ContentSlotRenderer - Renders RichContent (either InlineRichText or ContentSlot)
 *
 * For InlineRichText (v1): delegates to existing inline renderer
 * For ContentSlot (v2): renders items in vertical stack
 */
export function ContentSlotRenderer({ content, className }: ContentSlotRendererProps) {
  // Handle legacy InlineRichText (v1)
  if (isInlineRichText(content)) {
    return (
      <RichTextRenderer
        block={{
          type: 'rich_text',
          format: content.format,
          value: content.value,
          mediaIds: content.mediaIds,
        }}
      />
    )
  }

  // Handle ContentSlot (v2)
  const slot = content as ContentSlot
  const items = slot.items || []

  if (items.length === 0) {
    return null
  }

  return (
    <div className={`content-slot-renderer ${className || ''}`}>
      {items.map((item) => (
        <ContentSlotItemRenderer key={item.id} item={item} />
      ))}
    </div>
  )
}

interface ContentSlotItemRendererProps {
  item: ContentSlotItem
}

/**
 * Render a single ContentSlotItem based on its type
 */
function ContentSlotItemRenderer({ item }: ContentSlotItemRendererProps) {
  const { data } = item

  switch (data.type) {
    case 'rich_text':
      return (
        <div className="content-slot-item content-slot-item--rich-text">
          <RichTextRenderer
            block={{
              type: 'rich_text',
              format: data.format || 'md-math-v1',
              value: data.value || '',
              mediaIds: data.mediaIds,
            }}
          />
        </div>
      )

    case 'latex': {
      // Wrap raw LaTeX in delimiters so MathMarkdown renders it as math
      const latexContent = data.renderMode === 'block'
        ? `$$${data.latex || ''}$$`
        : `$${data.latex || ''}$`
      return (
        <div className="content-slot-item content-slot-item--latex">
          <MathMarkdown content={latexContent} />
        </div>
      )
    }

    case 'svg':
      return (
        <div className="content-slot-item content-slot-item--svg">
          <SvgRenderer
            block={{
              id: item.id,
              type: 'svg',
              value: data.value || '',
              altText: data.altText,
              interactive: false,
              hotspots: [],
            }}
          />
        </div>
      )

    case 'media':
      return (
        <div className="content-slot-item content-slot-item--media">
          <MediaAttachments mediaIds={[data.mediaId]} />
        </div>
      )

    case 'axis_display':
      return (
        <div className="content-slot-item content-slot-item--axis-display">
          <Suspense fallback={<AxisSkeleton />}>
            <LazyAxisRenderer blockId={item.id} spec={data.axis} displaySize={data.displaySize} />
          </Suspense>
        </div>
      )

    case 'geometry_display':
      return (
        <div className="content-slot-item content-slot-item--geometry-display">
          <Suspense fallback={<GeometrySkeleton />}>
            <LazyGeometryRenderer blockId={item.id} spec={data.geometry} />
          </Suspense>
        </div>
      )

    case 'html':
      return (
        <div className="content-slot-item content-slot-item--html">
          <HtmlBlockRenderer block={{ type: 'html', html: data.html || '' }} />
        </div>
      )

    default:
      // Handle unknown types gracefully
      return (
        <div className="content-slot-item content-slot-item--unknown">
          <span className="text-muted-foreground text-body-sm">Unknown content type</span>
        </div>
      )
  }
}

/**
 * Skeleton placeholder for AxisRenderer lazy loading
 */
function AxisSkeleton() {
  return (
    <div className="animate-pulse bg-muted rounded-md h-64 flex items-center justify-center">
      <span className="text-muted-foreground">Loading graph...</span>
    </div>
  )
}

/**
 * Skeleton placeholder for GeometryRenderer lazy loading
 */
function GeometrySkeleton() {
  return (
    <div className="animate-pulse bg-muted rounded-md h-64 flex items-center justify-center">
      <span className="text-muted-foreground">Loading geometry...</span>
    </div>
  )
}

export default ContentSlotRenderer

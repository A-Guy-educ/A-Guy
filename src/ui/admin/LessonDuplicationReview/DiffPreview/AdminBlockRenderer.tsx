/**
 * AdminBlockRenderer — read-only block renderer for admin diff preview.
 *
 * Dispatches on block.type and calls the same typed renderers as
 * ExerciseRenderer, but without any interactive state (no answer
 * checking, no localStorage, no progress bar, no help system).
 *
 * @fileType component
 * @domain admin
 * @ai-summary Read-only block renderer for admin diff preview.
 */
'use client'

import React from 'react'
import { RichTextRenderer } from '@/ui/web/exerciserenderer/blocks/RichTextRenderer'
import { LatexBlockRenderer } from '@/ui/web/exerciserenderer/blocks/LatexBlockRenderer'
import { SvgRenderer } from '@/ui/web/exerciserenderer/blocks/SvgRenderer'
import { GeometryRenderer } from '@/ui/web/exerciserenderer/blocks/GeometryRenderer'
import { AxisRenderer } from '@/ui/web/exerciserenderer/blocks/AxisRenderer'
import { MultiAxisRenderer } from '@/ui/web/exerciserenderer/blocks/MultiAxisRenderer'
import { HtmlBlockRenderer } from '@/ui/web/exerciserenderer/blocks/HtmlBlockRenderer'
import { GraphWithPrompt } from '@/ui/web/exerciserenderer/blocks/GraphWithPrompt'
import type { ContentBlock, InlineRichText } from '@/server/payload/collections/Exercises/types'
import type { GeometrySpecV1, AxisSpecV1 } from '@/infra/contracts'
import type { DisplaySize } from '@/ui/web/exerciserenderer/blocks/AxisRenderer'

interface AdminBlockRendererProps {
  blocks: ContentBlock[]
}

export function AdminBlockRenderer({ blocks }: AdminBlockRendererProps) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block) => (
        <BlockItem key={block.id} block={block} />
      ))}
    </div>
  )
}

function BlockItem({ block }: { block: ContentBlock }) {
  const b = block as ContentBlock & {
    geometry?: unknown
    axis?: unknown
    layout?: string
    prompt?: InlineRichText
    graphs?: unknown[]
    displaySize?: DisplaySize
  }

  if (block.type === 'rich_text') {
    return (
      <div className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed">
        <RichTextRenderer block={block} />
      </div>
    )
  }

  if (block.type === 'latex') {
    return (
      <div className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed">
        <LatexBlockRenderer block={block} />
      </div>
    )
  }

  if (block.type === 'svg') {
    return (
      <div className="not-prose">
        <SvgRenderer block={block} />
      </div>
    )
  }

  if (block.type === 'html') {
    return (
      <div className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed">
        <HtmlBlockRenderer block={block} />
      </div>
    )
  }

  if (block.type === 'media') {
    return (
      <div className="bg-muted text-muted-foreground p-4 rounded-lg text-label">
        [mediaId: {(block as { mediaId: string }).mediaId}]
      </div>
    )
  }

  // Geometry question — wrap in GraphWithPrompt
  if (block.type === 'question_geometry') {
    const geometryBlock = block as ContentBlock & { geometry?: GeometrySpecV1 }
    return (
      <GraphWithPrompt
        blockId={b.id}
        layout={(b.layout as 'textAbove' | 'textBelow' | 'textLeft' | 'textRight') || 'textRight'}
        prompt={b.prompt}
      >
        <GeometryRenderer blockId={b.id} spec={geometryBlock.geometry as GeometrySpecV1} />
      </GraphWithPrompt>
    )
  }

  // Axis question — wrap in GraphWithPrompt
  if (block.type === 'question_axis') {
    const axisBlock = block as ContentBlock & {
      axis?: AxisSpecV1
      displaySize?: DisplaySize
    }
    return (
      <GraphWithPrompt
        blockId={b.id}
        layout={(b.layout as 'textAbove' | 'textBelow' | 'textLeft' | 'textRight') || 'textRight'}
        prompt={b.prompt as InlineRichText | undefined}
      >
        <AxisRenderer
          blockId={b.id}
          spec={axisBlock.axis as AxisSpecV1}
          displaySize={axisBlock.displaySize}
        />
      </GraphWithPrompt>
    )
  }

  // Multi-axis question
  if (block.type === 'question_multi_axis') {
    const multiAxisBlock = b as unknown as {
      id: string
      graphs: Array<{ id: string; label: string; axis: AxisSpecV1; order: number }>
      prompt?: InlineRichText
      textPosition?: 'above' | 'below'
      columnsPerRow?: 1 | 2 | 4
    }
    return (
      <MultiAxisRenderer
        blockId={multiAxisBlock.id}
        graphs={multiAxisBlock.graphs}
        prompt={multiAxisBlock.prompt}
        textPosition={multiAxisBlock.textPosition ?? 'above'}
        columnsPerRow={multiAxisBlock.columnsPerRow}
      />
    )
  }

  // Question blocks — render as static prompts only (no answer UI)
  if (
    block.type === 'question_select' ||
    block.type === 'question_free_response' ||
    block.type === 'question_table' ||
    block.type === 'question_matching'
  ) {
    const questionBlock = block as {
      prompt?: InlineRichText
      hint?: InlineRichText
    }
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-label text-muted-foreground mb-2">
          [{block.type.replace('question_', '')}]
        </p>
        {questionBlock.prompt && (
          <div className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed">
            <RichTextRenderer block={questionBlock.prompt} />
          </div>
        )}
        {questionBlock.hint && (
          <div className="mt-2 text-body-xs text-muted-foreground">
            Hint: {questionBlock.hint.value}
          </div>
        )}
      </div>
    )
  }

  // Fallback for unknown block types
  const unknownBlock = block as unknown as { type?: string }
  return (
    <div className="bg-muted text-muted-foreground p-4 rounded-lg text-label">
      Unknown block type: {unknownBlock.type ?? '?'}
    </div>
  )
}

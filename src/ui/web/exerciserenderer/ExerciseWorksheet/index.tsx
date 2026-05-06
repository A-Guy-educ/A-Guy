/**
 * ExerciseWorksheet
 *
 * Read-only, "printed worksheet" rendering of an exercise's content blocks.
 * Used by the PDF tab of DualModeLessonView so students see the same blocks
 * the Interactive tab edits — but laid out as a static document with no
 * answer inputs, no progress bar, no help system.
 *
 * Behavior per block type:
 *   - rich_text                  -> paragraph
 *   - latex                      -> hidden (matches the viewer default)
 *   - svg / media                -> figure
 *   - question_geometry          -> Hebrew label + prompt + diagram side-by-side via GraphWithPrompt
 *   - question_axis              -> Hebrew label + prompt + diagram side-by-side via GraphWithPrompt
 *   - question_multi_axis        -> prompt above/below grid of diagrams
 *   - question_select(true_false)-> Hebrew label + prompt + bulleted choice list (empty checkboxes)
 *   - question_select(mcq)       -> Hebrew label + prompt + bulleted choice list (empty radios)
 *   - question_free_response     -> Hebrew label + prompt (no answer lines — per issue #1396)
 *   - question_table             -> Hebrew label + prompt + empty table grid
 *   - question_matching          -> Hebrew label + prompt + two columns of items
 *
 * Side-by-side diagrams flip based on locale direction: text starts on the
 * reading side (left in LTR, right in RTL) and the diagram sits opposite.
 */

'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'
import { useLocale } from '@/ui/web/providers/I18n'
import { MediaMapProvider } from '../context/MediaMapContext'
import { RichTextRenderer } from '../blocks/RichTextRenderer'
import { HtmlBlockRenderer } from '../blocks/HtmlBlockRenderer'
import { SvgRenderer } from '../blocks/SvgRenderer'
import { GeometryRenderer } from '../blocks/GeometryRenderer'
import { AxisRenderer } from '../blocks/AxisRenderer'
import { GraphWithPrompt } from '../blocks/GraphWithPrompt'
import { MultiAxisRenderer } from '../blocks/MultiAxisRenderer'
import { getMediaUrl } from '@/infra/utils/getMediaUrl'
import { HEBREW_LETTERS } from '../constants'
import type { Media } from '@/payload-types'
import type {
  ContentBlock,
  GraphLayout,
  InlineRichText,
  MediaBlock,
  QuestionAxisBlock,
  QuestionGeometryBlock,
  QuestionFreeResponseBlock,
  QuestionMatchingBlock,
  QuestionMultiAxisBlock,
  QuestionSelectMcqBlock,
  QuestionSelectTrueFalseBlock,
  QuestionTableBlock,
  RichTextBlock,
  SvgBlock,
} from '@/server/payload/collections/Exercises/types'

interface ExerciseWorksheetProps {
  blocks: ContentBlock[]
  /** Pre-resolved media map keyed by ID. */
  mediaMap?: Record<string, Media>
  className?: string
}

const EMPTY_MEDIA_MAP: Record<string, Media> = {}

export function ExerciseWorksheet({
  blocks,
  mediaMap = EMPTY_MEDIA_MAP,
  className,
}: ExerciseWorksheetProps) {
  const locale = useLocale()
  const isRtl = locale?.toLowerCase().startsWith('he') ?? false

  // Side-by-side layout: text on the reading-start side, diagram opposite.
  // LTR -> text left, diagram right ('textLeft'); RTL -> text right, diagram
  // left ('textRight'). GraphWithPrompt forces dir='ltr' on its flex
  // container so 'textLeft' / 'textRight' always describe physical position.
  const sideBySideLayout: GraphLayout = isRtl ? 'textRight' : 'textLeft'

  // Track question index for Hebrew letter labels (RTL only)
  let questionIndex = 0

  return (
    <MediaMapProvider value={mediaMap}>
      <div className={cn('flex flex-col gap-content-gap-lg', className)}>
        {blocks.map((block, i) => {
          const { block: renderedBlock, incremented } = renderBlockWithLabel({
            block,
            mediaMap,
            sideBySideLayout,
            isRtl,
            questionIndex,
          })
          if (incremented) questionIndex++
          return <React.Fragment key={getBlockKey(block, i)}>{renderedBlock}</React.Fragment>
        })}
      </div>
    </MediaMapProvider>
  )
}

function getBlockKey(block: ContentBlock, index: number): string {
  return 'id' in block && block.id ? block.id : `block_${index}`
}

/** Question types that receive Hebrew letter labels */
const LABELLED_QUESTION_TYPES = new Set([
  'question_select',
  'question_free_response',
  'question_table',
  'question_matching',
  'question_geometry',
  'question_axis',
])

interface RenderBlockParams {
  block: ContentBlock
  mediaMap: Record<string, Media>
  sideBySideLayout: GraphLayout
  isRtl: boolean
  questionIndex: number
}

/**
 * Renders a block and returns it with a Hebrew question label if applicable.
 * Returns { block: ReactNode, incremented: boolean } where incremented indicates
 * whether the question index was used (so the caller can increment the counter).
 */
function renderBlockWithLabel({
  block,
  mediaMap,
  sideBySideLayout,
  isRtl,
  questionIndex,
}: RenderBlockParams): { block: React.ReactNode; incremented: boolean } {
  const isLabelledQuestion = LABELLED_QUESTION_TYPES.has(block.type)

  if (isLabelledQuestion) {
    const label = isRtl
      ? `${HEBREW_LETTERS[questionIndex] || String(questionIndex + 1)}.`
      : `${questionIndex + 1}.`
    const inner = renderBlockContent({ block, mediaMap, sideBySideLayout })
    return {
      block: (
        <>
          <WorksheetQuestionLabel label={label} dir={isRtl ? 'rtl' : 'ltr'} />
          {inner}
        </>
      ),
      incremented: true,
    }
  }

  return {
    block: renderBlockContent({ block, mediaMap, sideBySideLayout }),
    incremented: false,
  }
}

/** Renders the content of a single block (no label) */
function renderBlockContent({
  block,
  mediaMap,
  sideBySideLayout,
}: Omit<RenderBlockParams, 'isRtl' | 'questionIndex'>): React.ReactNode {
  // LaTeX blocks: hidden, parsed structured blocks beside them already cover
  // the content. Matches ExerciseRenderer's default.
  if (block.type === 'latex') return null

  if (block.type === 'rich_text') {
    return (
      <div className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed">
        <RichTextRenderer block={block as RichTextBlock} />
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

  if (block.type === 'svg') {
    return (
      <figure className="my-2 flex justify-center">
        <SvgRenderer block={block as SvgBlock} />
      </figure>
    )
  }

  if (block.type === 'media') {
    return <WorksheetMedia block={block as MediaBlock} mediaMap={mediaMap} />
  }

  if (block.type === 'question_geometry') {
    const b = block as QuestionGeometryBlock
    const { canvas } = b.geometry
    // Guard against zero/invalid dimensions
    const aspectRatio =
      canvas?.width && canvas?.height && canvas.height > 0
        ? canvas.width / canvas.height
        : undefined
    const layout = pickGraphLayout(b.layout, sideBySideLayout, aspectRatio)
    return (
      <GraphWithPrompt
        blockId={b.id}
        layout={layout}
        prompt={b.prompt}
        worksheetLayout={{ sideContentAspectRatio: aspectRatio }}
      >
        <GeometryRenderer blockId={b.id} spec={b.geometry} />
      </GraphWithPrompt>
    )
  }

  if (block.type === 'question_axis') {
    const b = block as QuestionAxisBlock
    // AxisRenderer renders an approximately square/landscape board. Aspect 1.5
    // is below the 5/3 wrap threshold so the axis stays side-by-side, matching
    // geometry's default 600×400 canvas behavior.
    const axisAspectRatio = 1.5
    const layout = pickGraphLayout(b.layout, sideBySideLayout, axisAspectRatio)
    return (
      <GraphWithPrompt
        blockId={b.id}
        layout={layout}
        prompt={b.prompt}
        worksheetLayout={{ sideContentAspectRatio: axisAspectRatio }}
      >
        <AxisRenderer blockId={b.id} spec={b.axis} displaySize={b.displaySize} />
      </GraphWithPrompt>
    )
  }

  if (block.type === 'question_multi_axis') {
    const b = block as QuestionMultiAxisBlock
    return (
      <MultiAxisRenderer
        blockId={b.id}
        graphs={b.graphs}
        prompt={b.prompt}
        textPosition={b.textPosition ?? 'above'}
        columnsPerRow={b.columnsPerRow}
      />
    )
  }

  if (block.type === 'question_select') {
    if (block.variant === 'true_false') {
      return <WorksheetTrueFalse block={block as QuestionSelectTrueFalseBlock} />
    }
    return <WorksheetMcq block={block as QuestionSelectMcqBlock} />
  }

  if (block.type === 'question_free_response') {
    return <WorksheetFreeResponse block={block as QuestionFreeResponseBlock} />
  }

  if (block.type === 'question_table') {
    return <WorksheetTable block={block as QuestionTableBlock} />
  }

  if (block.type === 'question_matching') {
    return <WorksheetMatching block={block as QuestionMatchingBlock} />
  }

  return null
}

interface WorksheetQuestionLabelProps {
  label: string
  dir: 'ltr' | 'rtl'
}

function WorksheetQuestionLabel({ label, dir }: WorksheetQuestionLabelProps) {
  return (
    <div
      className={cn(
        'w-full flex items-center mb-3',
        dir === 'rtl'
          ? 'justify-end text-right flex-row-reverse gap-content-gap-xs'
          : 'justify-start text-left gap-content-gap-xs',
      )}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20">
        <span className="font-extrabold text-body-sm text-primary">{label}</span>
      </div>
    </div>
  )
}

/**
 * 3/5 wrap rule: side content stacks below the prompt only when it is
 * wider than 5:3 (aspect ratio > 5/3 ≈ 1.667). Square or portrait content
 * stays side-by-side. The default 600×400 canvas (1.5) is intentionally
 * below the threshold so the common case is side-by-side.
 */
const WRAP_ASPECT_THRESHOLD = 5 / 3

function pickGraphLayout(
  stored: GraphLayout | undefined,
  fallback: GraphLayout,
  aspectRatio?: number,
): GraphLayout {
  // Honour the author's explicit vertical choice as-is.
  if (stored === 'textAbove' || stored === 'textBelow') return stored

  const shouldWrap = aspectRatio !== undefined && aspectRatio > WRAP_ASPECT_THRESHOLD

  if (stored === 'textLeft') {
    return shouldWrap ? 'textBelow' : 'textLeft'
  }
  if (stored === 'textRight') {
    return shouldWrap ? 'textAbove' : 'textRight'
  }

  // No stored layout — use locale fallback, applying the wrap rule
  if (shouldWrap) {
    return fallback === 'textLeft' ? 'textBelow' : 'textAbove'
  }
  return fallback
}

function PromptText({ prompt }: { prompt: InlineRichText | undefined }) {
  if (!prompt || !prompt.value || !prompt.value.trim()) return null
  const block: RichTextBlock = {
    id: 'prompt',
    type: 'rich_text',
    format: prompt.format,
    value: prompt.value,
    mediaIds: prompt.mediaIds ?? [],
  }
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed">
      <RichTextRenderer block={block} />
    </div>
  )
}

function ChoiceLabel({ content }: { content: InlineRichText }) {
  const block: RichTextBlock = {
    id: 'choice',
    type: 'rich_text',
    format: content.format,
    value: content.value,
    mediaIds: content.mediaIds ?? [],
  }
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none flex-1 text-foreground leading-relaxed prose-p:my-0">
      <RichTextRenderer block={block} />
    </div>
  )
}

function WorksheetTrueFalse({ block }: { block: QuestionSelectTrueFalseBlock }) {
  return (
    <div className="flex flex-col gap-content-gap-xs">
      <PromptText prompt={block.prompt} />
      <ul className="flex flex-col gap-1.5 ps-6 list-none">
        {block.options.map((opt) => (
          <li key={opt.id} className="flex items-start gap-content-gap-xs">
            <span
              aria-hidden
              className="mt-1 inline-block h-3.5 w-3.5 flex-shrink-0 rounded-sm border border-foreground/60"
            />
            <ChoiceLabel content={opt.label} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function WorksheetMcq({ block }: { block: QuestionSelectMcqBlock }) {
  const isMulti = block.selectionMode === 'multiple'
  return (
    <div className="flex flex-col gap-content-gap-xs">
      <PromptText prompt={block.prompt} />
      <ul className="flex flex-col gap-1.5 ps-6 list-none">
        {block.answer.options.map((opt) => (
          <li key={opt.id} className="flex items-start gap-content-gap-xs">
            <span
              aria-hidden
              className={cn(
                'mt-1 inline-block h-3.5 w-3.5 flex-shrink-0 border border-foreground/60',
                isMulti ? 'rounded-sm' : 'rounded-full',
              )}
            />
            <ChoiceLabel content={opt.content} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function WorksheetFreeResponse({ block }: { block: QuestionFreeResponseBlock }) {
  return (
    <div className="flex flex-col gap-3">
      <PromptText prompt={block.prompt} />
      {/* Answer lines removed per issue #1396 — solutions appear in a collected section at the end of the document */}
    </div>
  )
}

const ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

function WorksheetTable({ block }: { block: QuestionTableBlock }) {
  const { headers, rowsData, showBorders, showHeader, columnAlignment } = block.table
  const alignClass = (i: number) => ALIGN_CLASS[columnAlignment?.[i] ?? 'left']
  const cellBase = showBorders ? 'border border-foreground/40 px-3 py-2' : 'px-3 py-2'

  // 3/5 wrap heuristic for tables: column count as proxy for aspect ratio.
  // <= 4 columns -> table is narrow enough to fit side-by-side at 40% / 25rem cap.
  // > 4 columns -> table too wide -> stack vertically.
  const isNarrowTable = headers.length <= 4

  // Always use LTR for the layout container so side-by-side is consistent.
  const dir: 'ltr' | 'rtl' = 'ltr'

  return (
    <div className="flex flex-col gap-content-gap-xs">
      {isNarrowTable ? (
        // Side-by-side: 60/40, mobile stacks prompt-first
        <div className="flex flex-col sm:flex-row gap-content-gap" dir={dir}>
          {/* Prompt first on mobile (sm:order-first), full width on mobile */}
          <div className="flex-[3] sm:order-first min-h-[60px]">
            <PromptText prompt={block.prompt} />
          </div>
          {/* Table on the right (mobile: full width below) */}
          <div className="flex-[2] max-w-[25rem]">
            <table className="w-full table-fixed border-collapse text-body-sm">
              {showHeader && headers.length > 0 && (
                <thead>
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className={cn(cellBase, 'bg-muted font-semibold', alignClass(i))}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {rowsData.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={cn(cellBase, alignClass(ci))}>
                        {cell || ' '}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Stacked: prompt above, table below
        <div className="flex flex-col gap-content-gap-xs">
          <PromptText prompt={block.prompt} />
          <table className="w-full table-fixed border-collapse text-body-sm">
            {showHeader && headers.length > 0 && (
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className={cn(cellBase, 'bg-muted font-semibold', alignClass(i))}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rowsData.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={cn(cellBase, alignClass(ci))}>
                      {cell || ' '}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function WorksheetMatching({ block }: { block: QuestionMatchingBlock }) {
  return (
    <div className="flex flex-col gap-3">
      <PromptText prompt={block.prompt} />
      <div className="grid grid-cols-2 gap-x-8 gap-y-2">
        <ul className="flex flex-col gap-1.5 list-none">
          {block.leftColumn.map((opt) => (
            <li key={opt.id} className="rounded border border-foreground/30 px-3 py-2">
              <ChoiceLabel content={opt.content} />
            </li>
          ))}
        </ul>
        <ul className="flex flex-col gap-1.5 list-none">
          {block.rightColumn.map((opt) => (
            <li key={opt.id} className="rounded border border-foreground/30 px-3 py-2">
              <ChoiceLabel content={opt.content} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function WorksheetMedia({
  block,
  mediaMap,
}: {
  block: MediaBlock
  mediaMap: Record<string, Media>
}) {
  const media = mediaMap[block.mediaId]
  if (!media) return null
  const isVideo = media.mimeType?.startsWith('video/')
  if (isVideo) {
    // PDF view stays static — render a placeholder that says "Video".
    return (
      <figure className="my-2 rounded-md border border-dashed border-foreground/40 px-4 py-3 text-center text-body-sm text-muted-foreground">
        🎬 {media.filename ?? 'Video'}
      </figure>
    )
  }
  const src = getMediaUrl(media.url)
  return (
    <figure className="my-2 flex justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={media.alt || media.filename || ''}
        className="max-h-96 w-auto object-contain"
      />
    </figure>
  )
}

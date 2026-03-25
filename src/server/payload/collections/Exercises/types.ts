/**
 * Shared Exercise Content Types
 *
 * These types are used by both:
 * - Server: Collection config and validation
 * - Client: Admin UI components
 */

import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'

// ---------------------------------
// Inline Rich Text (used inside question blocks - NO id)
// ---------------------------------
export interface InlineRichText {
  type: 'rich_text'
  format: 'md-math-v1'
  value: string
  mediaIds: string[]
}

// ---------------------------------
// Rich Text Block (stand-alone - HAS id)
// ---------------------------------
export interface RichTextBlock {
  id: string
  type: 'rich_text'
  format: 'md-math-v1'
  value: string
  mediaIds: string[]
}

// ---------------------------------
// Answer Types
// ---------------------------------
export interface TrueFalseAnswer {
  correctOptionId?: string
}

export interface McqOption {
  id: string
  content: RichContent
}

export interface McqAnswer {
  multiSelect: boolean
  options: McqOption[]
  correctOptionIds: string[]
}

export interface FreeResponseAnswer {
  acceptedAnswers: string[]
}

// ---------------------------------
// Question Select Block (True/False)
// ---------------------------------
export interface QuestionSelectTrueFalseBlock {
  id: string
  type: 'question_select'
  variant: 'true_false'
  selectionMode: 'single'
  prompt: RichContent
  options: ReadonlyArray<{
    id: 'true' | 'false'
    value: boolean
    label: RichContent
  }>
  answer: TrueFalseAnswer
  hint?: RichContent
  solution?: RichContent
  fullSolution?: RichContent
}

// ---------------------------------
// Question Select Block (MCQ)
// ---------------------------------
export interface QuestionSelectMcqBlock {
  id: string
  type: 'question_select'
  variant: 'mcq'
  selectionMode: 'single' | 'multiple'
  prompt: RichContent
  answer: McqAnswer
  hint?: RichContent
  solution?: RichContent
  fullSolution?: RichContent
}

// ---------------------------------
// Question Free Response Block
// ---------------------------------
export interface QuestionFreeResponseBlock {
  id: string
  type: 'question_free_response'
  prompt: RichContent
  answer: FreeResponseAnswer
  hint?: RichContent
  solution?: RichContent
  fullSolution?: RichContent
}

// ---------------------------------
// Table Block (used inside QuestionTableBlock)
// ---------------------------------
export interface TableBlock {
  solutionFill: boolean
  headers: string[]
  rowsData: string[][]
  answers: Record<string, string> | undefined
  showBorders: boolean
  showHeader: boolean
  columnAlignment?: ('left' | 'center' | 'right')[]
}

// ---------------------------------
// Question Table Block
// ---------------------------------
export interface QuestionTableBlock {
  id: string
  type: 'question_table'
  prompt: RichContent
  table: TableBlock
  hint?: RichContent
  solution?: RichContent
  fullSolution?: RichContent
}

// ---------------------------------
// Latex Block
// ---------------------------------
export interface LatexBlock {
  id: string
  type: 'latex'
  latex: string
  renderMode?: 'block' | 'inline'
}

// ---------------------------------
// Matching Option (single item in left or right column)
// ---------------------------------
export interface MatchingOption {
  id: string
  content: RichContent
}

// ---------------------------------
// Matching Pair (answer key - which left matches which right)
// ---------------------------------
export interface MatchingPair {
  optionId: string // ID from left column
  matchId: string // ID from right column that matches
}

// ---------------------------------
// Question Matching Block
// ---------------------------------
export interface QuestionMatchingBlock {
  id: string
  type: 'question_matching'
  prompt: RichContent
  leftColumn: MatchingOption[] // Items to match from
  rightColumn: MatchingOption[] // Items to match to
  correctPairs: MatchingPair[] // Answer key
  shuffleRightColumn?: boolean // UI can shuffle for display
  hint?: RichContent
  solution?: RichContent
  fullSolution?: RichContent
}

// ---------------------------------
// SVG Hotspot (clickable region within an SVG)
// ---------------------------------
export interface SvgHotspot {
  id: string
  selector: string // CSS selector or element ID to match in SVG DOM
  label?: string // Accessible label for the hotspot
}

// ---------------------------------
// SVG Block (raw SVG markup)
// ---------------------------------
export interface SvgBlock {
  id: string
  type: 'svg'
  value: string // Raw SVG markup
  altText?: string // Accessibility description
  caption?: RichContent
  interactive?: boolean // If true, hotspots are clickable
  hotspots?: SvgHotspot[] // Clickable regions (only when interactive=true)
  correctHotspotIds?: string[] // Answer key: which hotspot IDs are correct
  hint?: RichContent
  solution?: RichContent
  fullSolution?: RichContent
}

// ---------------------------------
// Generic Question Answer (used by Geometry + Axis)
// ---------------------------------
export type QuestionAnswer =
  | { kind: 'numeric'; value: number; tolerance?: number }
  | { kind: 'mcq'; options: McqOption[]; correctOptionIds: string[] }
  | { kind: 'free_response'; acceptedAnswers: string[] }
  | { kind: 'point'; x: number; y: number; tolerance?: number }
  | { kind: 'function'; acceptedExpressions: string[] }

// ---------------------------------
// Graph Layout Type (for geometry and axis blocks)
// ---------------------------------
export type GraphLayout = 'textAbove' | 'textBelow' | 'textLeft' | 'textRight'

// ---------------------------------
// Question Geometry Block
// ---------------------------------
export interface QuestionGeometryBlock {
  id: string
  type: 'question_geometry'
  prompt: RichContent
  layout?: GraphLayout
  geometry: GeometrySpecV1
  answer?: QuestionAnswer
  hint?: RichContent
  solution?: RichContent
  fullSolution?: RichContent
}

// ---------------------------------
// Question Axis Block
// ---------------------------------
export interface QuestionAxisBlock {
  id: string
  type: 'question_axis'
  prompt: RichContent
  layout?: GraphLayout
  axis: AxisSpecV1
  displaySize?: 'small' | 'medium' | 'large' | 'full'
  answer?: QuestionAnswer
  hint?: RichContent
  solution?: RichContent
  fullSolution?: RichContent
}

// ---------------------------------
// Multi-Axis Graph Item (single graph within multi-axis block)
// ---------------------------------
export interface MultiAxisGraphItem {
  id: string
  label: string
  axis: AxisSpecV1
  order: number
}

// ---------------------------------
// Question Multi-Axis Block (multiple graphs in one block)
// ---------------------------------
export interface QuestionMultiAxisBlock {
  id: string
  type: 'question_multi_axis'
  prompt?: RichContent
  textPosition: 'above' | 'below'
  graphs: MultiAxisGraphItem[]
}

// ---------------------------------
// HTML Block (WYSIWYG rich content)
// ---------------------------------
export interface HtmlBlock {
  id: string
  type: 'html'
  html: string
}

// ---------------------------------
// Media Block (reference to a single media item)
// ---------------------------------
export interface MediaBlock {
  id: string
  type: 'media'
  mediaId: string
}

// ---------------------------------
// Union Type
// ---------------------------------
export type ContentBlock =
  | RichTextBlock
  | QuestionSelectTrueFalseBlock
  | QuestionSelectMcqBlock
  | QuestionFreeResponseBlock
  | QuestionTableBlock
  | LatexBlock
  | QuestionMatchingBlock
  | SvgBlock
  | QuestionGeometryBlock
  | QuestionAxisBlock
  | QuestionMultiAxisBlock
  | HtmlBlock
  | MediaBlock

// ---------------------------------
// Content Container
// ---------------------------------
export interface ContentData {
  blocks: ContentBlock[]
}

// ---------------------------------
// Display-only variants — portable Axis/Geometry without question/answer fields
// ---------------------------------
export interface AxisDisplayData {
  type: 'axis_display'
  axis: AxisSpecV1
  displaySize?: 'small' | 'medium' | 'large' | 'full'
}

export interface GeometryDisplayData {
  type: 'geometry_display'
  geometry: GeometrySpecV1
}

// ---------------------------------
// ContentSlot Item Data Types (leaf nodes for slots)
// ---------------------------------
export type ContentSlotItemData =
  | { type: 'rich_text'; format: 'md-math-v1'; value: string; mediaIds: string[] }
  | { type: 'latex'; latex: string; renderMode?: 'block' | 'inline' }
  | { type: 'svg'; value: string; altText?: string }
  | { type: 'media'; mediaId: string }
  | AxisDisplayData
  | GeometryDisplayData
  | { type: 'html'; html: string }

// ---------------------------------
// ContentSlot Item (wrapper with id)
// ---------------------------------
export interface ContentSlotItem {
  id: string
  data: ContentSlotItemData
}

// ---------------------------------
// ContentSlot - Universal container for rich content (v2)
// ---------------------------------
export interface ContentSlot {
  version: 2
  items: ContentSlotItem[]
}

// ---------------------------------
// RichContent Union - supports both v1 (InlineRichText) and v2 (ContentSlot)
// ---------------------------------
export type RichContent = InlineRichText | ContentSlot

// ---------------------------------
// ID Generator (browser and server compatible)
// ---------------------------------
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'b-' + Math.random().toString(36).substring(2, 9)
}

// ---------------------------------
// Type Guards
// ---------------------------------

/**
 * Check if a value is a ContentSlot (v2)
 */
export function isContentSlot(value: unknown): value is ContentSlot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    (value as ContentSlot).version === 2 &&
    'items' in value &&
    Array.isArray((value as ContentSlot).items)
  )
}

/**
 * Check if a value is InlineRichText (v1)
 * Mutually exclusive with isContentSlot - checks that version is NOT present
 */
export function isInlineRichText(value: unknown): value is InlineRichText {
  return (
    typeof value === 'object' &&
    value !== null &&
    !('version' in value) && // Exclude ContentSlot which has version: 2
    'type' in value &&
    (value as InlineRichText).type === 'rich_text' &&
    'format' in value &&
    (value as InlineRichText).format === 'md-math-v1'
  )
}

/**
 * Check if a value is RichContent (union of v1 and v2)
 */
export function isRichContent(value: unknown): value is RichContent {
  return isInlineRichText(value) || isContentSlot(value)
}

// ---------------------------------
// Helper Functions for RichContent
// ---------------------------------

/**
 * Extract text from RichContent regardless of format
 */
export function getRichContentText(rc: RichContent): string {
  if (isInlineRichText(rc)) {
    return rc.value
  }
  // ContentSlot - extract text from all rich_text items
  return rc.items
    .filter(
      (item): item is ContentSlotItem & { data: { type: 'rich_text'; value: string } } =>
        item.data.type === 'rich_text',
    )
    .map((item) => item.data.value)
    .join('\n')
}

/**
 * Extract media IDs from RichContent regardless of format
 */
export function getRichContentMediaIds(rc: RichContent): string[] {
  if (isInlineRichText(rc)) {
    return rc.mediaIds
  }
  // ContentSlot - extract mediaIds from all rich_text items
  return rc.items
    .filter(
      (item): item is ContentSlotItem & { data: { type: 'rich_text'; mediaIds: string[] } } =>
        item.data.type === 'rich_text',
    )
    .flatMap((item) => item.data.mediaIds)
}

/**
 * Check if RichContent has meaningful text content
 */
export function hasRichContentText(rc: RichContent | undefined): boolean {
  if (!rc) return false
  return getRichContentText(rc).trim().length > 0
}

// ---------------------------------
// Conversion Functions (for backward compatibility)
// ---------------------------------

/**
 * Convert InlineRichText (v1) to ContentSlot (v2)
 */
export function inlineRichTextToSlot(irt: InlineRichText): ContentSlot {
  return {
    version: 2,
    items: [
      {
        id: generateId(),
        data: {
          type: 'rich_text',
          format: irt.format,
          value: irt.value,
          mediaIds: irt.mediaIds,
        },
      },
    ],
  }
}

/**
 * Convert ContentSlot (v2) back to InlineRichText (v1)
 * Only works if slot has exactly one rich_text item
 */
export function contentSlotToInlineRichText(slot: ContentSlot): InlineRichText | null {
  if (slot.items.length !== 1) {
    return null
  }
  const item = slot.items[0]
  if (item.data.type !== 'rich_text') {
    return null
  }
  return {
    type: 'rich_text',
    format: item.data.format,
    value: item.data.value,
    mediaIds: item.data.mediaIds,
  }
}

// ---------------------------------
// AI Chat Serialization Functions
// ---------------------------------

/**
 * Convert a ContentSlotItem to plain text for AI chat context
 */
export function contentSlotItemToText(item: ContentSlotItem): string {
  const data = item.data

  switch (data.type) {
    case 'rich_text':
      return data.value

    case 'latex':
      return `$$${data.latex}$$`

    case 'svg':
      return data.altText ? `[SVG: ${data.altText}]` : '[SVG]'

    case 'media':
      return '[Media]'

    case 'axis_display':
      return '[Graph: coordinate plane]'

    case 'geometry_display':
      return '[Geometry: construction]'

    case 'html':
      // Strip tags, keep text
      return data.html.replace(/<[^>]*>/g, '').trim()

    default:
      return '[Unknown content]'
  }
}

/**
 * Convert a ContentSlot to plain text for AI chat context
 */
export function contentSlotToText(slot: ContentSlot): string {
  return slot.items.map(contentSlotItemToText).join('\n')
}

/**
 * Convert RichContent (v1 or v2) to plain text for AI chat context
 */
export function richContentToText(content: RichContent): string {
  if (isInlineRichText(content)) {
    return content.value
  }
  return contentSlotToText(content)
}

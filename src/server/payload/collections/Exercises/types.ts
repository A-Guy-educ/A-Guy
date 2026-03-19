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
  content: InlineRichText
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
  prompt: InlineRichText
  options: ReadonlyArray<{
    id: 'true' | 'false'
    value: boolean
    label: InlineRichText
  }>
  answer: TrueFalseAnswer
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}

// ---------------------------------
// Question Select Block (MCQ)
// ---------------------------------
export interface QuestionSelectMcqBlock {
  id: string
  type: 'question_select'
  variant: 'mcq'
  selectionMode: 'single' | 'multiple'
  prompt: InlineRichText
  answer: McqAnswer
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}

// ---------------------------------
// Question Free Response Block
// ---------------------------------
export interface QuestionFreeResponseBlock {
  id: string
  type: 'question_free_response'
  prompt: InlineRichText
  answer: FreeResponseAnswer
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
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
  prompt: InlineRichText
  table: TableBlock
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
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
  content: InlineRichText
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
  prompt: InlineRichText
  leftColumn: MatchingOption[] // Items to match from
  rightColumn: MatchingOption[] // Items to match to
  correctPairs: MatchingPair[] // Answer key
  shuffleRightColumn?: boolean // UI can shuffle for display
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
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
  caption?: InlineRichText
  interactive?: boolean // If true, hotspots are clickable
  hotspots?: SvgHotspot[] // Clickable regions (only when interactive=true)
  correctHotspotIds?: string[] // Answer key: which hotspot IDs are correct
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
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
  prompt: InlineRichText
  layout?: GraphLayout
  geometry: GeometrySpecV1
  answer?: QuestionAnswer
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}

// ---------------------------------
// Question Axis Block
// ---------------------------------
export interface QuestionAxisBlock {
  id: string
  type: 'question_axis'
  prompt: InlineRichText
  layout?: GraphLayout
  axis: AxisSpecV1
  displaySize?: 'small' | 'medium' | 'large' | 'full'
  answer?: QuestionAnswer
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
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
  prompt?: InlineRichText
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
// ID Generator (browser and server compatible)
// ---------------------------------
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'b-' + Math.random().toString(36).substring(2, 9)
}

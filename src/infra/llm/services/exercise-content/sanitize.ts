/**
 * Exercise Content Sanitizer
 *
 * Strips correctness/answer fields from exercise content before exposing
 * to students via chat or other channels.
 *
 * @fileType utility
 * @domain ai
 * @pattern sanitization, data-cleaning
 *
 * IMPORTANT: This is a pure function - it does not mutate the input.
 */

import type {
  ContentData,
  ContentBlock,
  RichTextBlock,
  LatexBlock,
  QuestionSelectTrueFalseBlock,
  QuestionSelectMcqBlock,
  QuestionFreeResponseBlock,
  QuestionTableBlock,
  InlineRichText,
} from './types'

// Re-export ContentData for external consumers (e.g., student tools)
export type { ContentData } from './types'

// =============================================================================
// SANITIZED TYPES
// These represent the student-safe version of each block type
// =============================================================================

export interface SanitizedInlineRichText {
  type: 'rich_text'
  format: 'md-math-v1'
  value: string
  mediaIds: string[]
}

export interface SanitizedTrueFalseOptions {
  id: 'true' | 'false'
  value: boolean
  label: SanitizedInlineRichText
}

export interface SanitizedMcqOption {
  id: string
  content: SanitizedInlineRichText
}

export interface SanitizedMcqAnswer {
  multiSelect: boolean
  options: SanitizedMcqOption[]
}

export interface SanitizedTable {
  headers: string[]
  rowsData: string[][]
  showBorders: boolean
  showHeader: boolean
  columnAlignment?: ('left' | 'center' | 'right')[]
}

export type SanitizedBlock =
  | SanitizedRichTextBlock
  | SanitizedLatexBlock
  | SanitizedTrueFalseBlock
  | SanitizedMcqBlock
  | SanitizedFreeResponseBlock
  | SanitizedTableBlock

export interface SanitizedRichTextBlock {
  id: string
  type: 'rich_text'
  format: 'md-math-v1'
  value: string
  mediaIds: string[]
}

export interface SanitizedLatexBlock {
  id: string
  type: 'latex'
  latex: string
  renderMode?: 'block' | 'inline'
}

export interface SanitizedTrueFalseBlock {
  id: string
  type: 'question_select'
  variant: 'true_false'
  selectionMode: 'single'
  prompt: SanitizedInlineRichText
  options: ReadonlyArray<SanitizedTrueFalseOptions>
}

export interface SanitizedMcqBlock {
  id: string
  type: 'question_select'
  variant: 'mcq'
  selectionMode: 'single' | 'multiple'
  prompt: SanitizedInlineRichText
  answer: SanitizedMcqAnswer
}

export interface SanitizedFreeResponseBlock {
  id: string
  type: 'question_free_response'
  prompt: SanitizedInlineRichText
}

export interface SanitizedTableBlock {
  id: string
  type: 'question_table'
  prompt: SanitizedInlineRichText
  table: SanitizedTable
}

/**
 * Sanitized exercise content (without correctness fields)
 */
export interface SanitizedExerciseContent {
  blocks: SanitizedBlock[]
}

// =============================================================================
// SANITIZER FUNCTIONS
// =============================================================================

/**
 * Strip all correctness/answer fields from exercise content.
 * Returns a deep clone with only student-visible fields.
 *
 * @param content - The full exercise content with blocks
 * @returns Sanitized content safe for student exposure
 */
export function sanitizeExerciseContentForStudent(content: ContentData): SanitizedExerciseContent {
  // Deep clone to ensure purity
  const sanitized: SanitizedExerciseContent = {
    blocks: content.blocks.map((block) => sanitizeBlock(block)),
  }
  return sanitized
}

/**
 * Sanitize a single block based on its type.
 */
function sanitizeBlock(block: ContentBlock): SanitizedBlock {
  switch (block.type) {
    case 'rich_text':
      return sanitizeRichTextBlock(block)
    case 'latex':
      return sanitizeLatexBlock(block)
    case 'question_select':
      if (block.variant === 'true_false') {
        return sanitizeTrueFalseBlock(block)
      }
      return sanitizeMcqBlock(block)
    case 'question_free_response':
      return sanitizeFreeResponseBlock(block)
    case 'question_table':
      return sanitizeTableBlock(block)
    default:
      // TypeScript exhaustiveness check - should never reach here
      return block as unknown as SanitizedBlock
  }
}

/**
 * Rich text block - no correctness fields, pass through unchanged.
 */
function sanitizeRichTextBlock(block: RichTextBlock): SanitizedRichTextBlock {
  return {
    id: block.id,
    type: block.type,
    format: block.format,
    value: block.value,
    mediaIds: block.mediaIds,
  }
}

/**
 * LaTeX block - no correctness fields, pass through unchanged.
 */
function sanitizeLatexBlock(block: LatexBlock): SanitizedLatexBlock {
  return {
    id: block.id,
    type: block.type,
    latex: block.latex,
    renderMode: block.renderMode,
  }
}

/**
 * True/False question block.
 * Strips: answer, hint, solution, fullSolution.
 * Keeps: id, type, variant, selectionMode, prompt, options.
 */
function sanitizeTrueFalseBlock(block: QuestionSelectTrueFalseBlock): SanitizedTrueFalseBlock {
  return {
    id: block.id,
    type: block.type,
    variant: block.variant,
    selectionMode: block.selectionMode,
    prompt: sanitizeInlineRichText(block.prompt),
    options: block.options.map((opt) => ({
      id: opt.id,
      value: opt.value,
      label: sanitizeInlineRichText(opt.label),
    })),
  }
}

/**
 * MCQ question block.
 * Strips: answer.correctOptionIds, hint, solution, fullSolution.
 * Keeps: id, type, variant, selectionMode, prompt, answer.multiSelect, answer.options.
 */
function sanitizeMcqBlock(block: QuestionSelectMcqBlock): SanitizedMcqBlock {
  return {
    id: block.id,
    type: block.type,
    variant: block.variant,
    selectionMode: block.selectionMode,
    prompt: sanitizeInlineRichText(block.prompt),
    answer: {
      multiSelect: block.answer.multiSelect,
      options: block.answer.options.map((opt) => ({
        id: opt.id,
        content: sanitizeInlineRichText(opt.content),
      })),
    },
  }
}

/**
 * Free response block.
 * Strips: answer, hint, solution, fullSolution.
 * Keeps: id, type, prompt.
 */
function sanitizeFreeResponseBlock(block: QuestionFreeResponseBlock): SanitizedFreeResponseBlock {
  return {
    id: block.id,
    type: block.type,
    prompt: sanitizeInlineRichText(block.prompt),
  }
}

/**
 * Table block.
 * Strips: table.answers, table.solutionFill, hint, solution, fullSolution.
 * Keeps: id, type, prompt, table.headers, table.rowsData, table.showBorders, table.showHeader, table.columnAlignment.
 */
function sanitizeTableBlock(block: QuestionTableBlock): SanitizedTableBlock {
  return {
    id: block.id,
    type: block.type,
    prompt: sanitizeInlineRichText(block.prompt),
    table: {
      headers: block.table.headers,
      rowsData: block.table.rowsData,
      showBorders: block.table.showBorders,
      showHeader: block.table.showHeader,
      columnAlignment: block.table.columnAlignment,
    },
  }
}

/**
 * Sanitize inline rich text - pass through unchanged (no correctness fields in inline text).
 */
function sanitizeInlineRichText(rt: InlineRichText): SanitizedInlineRichText {
  return {
    type: rt.type,
    format: rt.format,
    value: rt.value,
    mediaIds: rt.mediaIds,
  }
}

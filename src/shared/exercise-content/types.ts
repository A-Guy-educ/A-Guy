/**
 * Shared Exercise Content Types
 *
 * Re-exports types from the server collection types for use in:
 * - Defaults (factory functions)
 * - Admin UI components
 *
 * This allows shared code to import from a consistent location.
 *
 * NOTE: This file contains ONLY type exports to prevent server code
 * from leaking into client bundles.
 */

export type {
  ContentBlock,
  HtmlBlock,
  InlineRichText,
  LatexBlock,
  McqOption,
  QuestionFreeResponseBlock,
  QuestionSelectMcqBlock,
  QuestionSelectTrueFalseBlock,
  QuestionTableBlock,
  RichTextBlock,
  TrueFalseAnswer,
} from '@/server/payload/collections/Exercises/types'

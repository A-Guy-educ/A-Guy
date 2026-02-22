/**
 * Shared Exercise Content Types
 *
 * Re-exports types from the server collection types for use in:
 * - Defaults (factory functions)
 * - Admin UI components
 *
 * This allows shared code to import from a consistent location.
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

export { generateId } from '@/server/payload/collections/Exercises/types'

/**
 * Shared Exercise Content Types
 *
 * These types are used by both:
 * - Server: Collection config and validation
 * - Client: Admin UI components
 */

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
// Latex Block
// ---------------------------------
export interface LatexBlock {
  id: string
  type: 'latex'
  latex: string
  renderMode?: 'block' | 'inline'
}

// ---------------------------------
// Union Type
// ---------------------------------
export type ContentBlock =
  | RichTextBlock
  | QuestionSelectTrueFalseBlock
  | QuestionSelectMcqBlock
  | QuestionFreeResponseBlock
  | LatexBlock

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

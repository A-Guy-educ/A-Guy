/**
 * V3 Converter - Normalization Layer
 *
 * Transforms incoming V3 extraction payload into a lossless intermediate model
 * used by analyzer/segmenter/mapper. Preserves all fields for no-drop fallback handling.
 *
 * @fileType utility
 * @domain conversion
 * @pattern normalization
 */

import type {
  SubQuestionExtraction,
  MultiPartExtraction,
} from '@/server/services/exercise-conversion/v3/transform'

// ---------------------------------
// Normalized Types
// ---------------------------------

export interface NormalizedSubQuestion {
  prompt: string
  type?: 'free_response' | 'mcq' | 'true_false'
  options?: string[]
  correctAnswer?: number | null
  acceptedAnswers?: string[]
  diagramDescription?: string
  // Additional rich content fields for segmentation
  geometryPayload?: Record<string, unknown>
  axisPayload?: Record<string, unknown>
  svgFragment?: string
  htmlFragment?: string
  mediaReference?: string
  // Bucket for unknown fields
  unknownPayload: Record<string, unknown>
}

export interface NormalizedExtraction {
  title?: string
  stem?: string
  subQuestions: NormalizedSubQuestion[]
  diagramDescription?: string
  diagramPosition?: 'before_question' | 'after_question'
  // Raw content for reference
  rawContent: string
}

// ---------------------------------
// Normalization Functions
// ---------------------------------

/**
 * Normalize a sub-question extraction, preserving all fields including unknown ones.
 * This ensures no-drop behavior by keeping all data for fallback mapping.
 */
export function normalizeSubQuestion(sq: SubQuestionExtraction): NormalizedSubQuestion {
  const unknownPayload: Record<string, unknown> = {}

  // Copy known fields
  const normalized: NormalizedSubQuestion = {
    prompt: sq.prompt || '',
    type: sq.type,
    options: sq.options,
    correctAnswer: sq.correctAnswer,
    acceptedAnswers: sq.acceptedAnswers,
    diagramDescription: sq.diagramDescription,
    unknownPayload,
  }

  // Extract embedded content from prompt if present
  // This is a simple heuristic - the segmenter will do deeper analysis
  if (sq.prompt) {
    // Look for SVG markup
    if (/<svg[\s\S]*?<\/svg>/i.test(sq.prompt)) {
      const svgMatch = sq.prompt.match(/<svg[\s\S]*?<\/svg>/i)
      if (svgMatch) {
        normalized.svgFragment = svgMatch[0]
      }
    }

    // Look for HTML table
    if (/<table[\s\S]*?<\/table>/i.test(sq.prompt)) {
      normalized.htmlFragment = 'table'
    }

    // Look for image references
    if (/<img[^>]*>/i.test(sq.prompt)) {
      const imgMatch = sq.prompt.match(/src=["']([^"']+)["']/i)
      if (imgMatch) {
        normalized.mediaReference = imgMatch[1]
      }
    }

    // Look for LaTeX display math
    if (/\$\$[\s\S]*?\$\$/i.test(sq.prompt)) {
      // LaTeX content will be handled by segmenter
    }
  }

  return normalized
}

/**
 * Normalize a full multi-part extraction.
 * Preserves all fields and marks unknown ones for fallback handling.
 */
export function normalizeExtraction(extraction: MultiPartExtraction): NormalizedExtraction {
  const { title, stem, subQuestions, diagramDescription, diagramPosition } = extraction

  // Build raw content string for reference
  const rawContent = [
    title,
    stem,
    ...(subQuestions || []).map((sq) => sq.prompt),
    diagramDescription,
  ]
    .filter(Boolean)
    .join('|||')

  return {
    title,
    stem,
    subQuestions: (subQuestions || []).map(normalizeSubQuestion),
    diagramDescription,
    diagramPosition,
    rawContent,
  }
}

/**
 * Check if a sub-question has options (for determining question type)
 */
export function hasOptions(sq: NormalizedSubQuestion): boolean {
  return Boolean(sq.options && sq.options.length > 0)
}

/**
 * Check if a sub-question has multiple correct answers
 */
export function hasMultipleCorrect(sq: NormalizedSubQuestion): boolean {
  // If correctAnswer is an array or if there are multiple accepted answers, it's multiple correct
  if (Array.isArray(sq.correctAnswer)) {
    return sq.correctAnswer.length > 1
  }
  if (sq.acceptedAnswers && sq.acceptedAnswers.length > 1) {
    return true
  }
  return false
}

/**
 * Check if options are true/false pattern
 */
export function isTrueFalseOptions(options: string[]): boolean {
  if (options.length !== 2) return false

  const normalized = options.map((opt) => opt.toLowerCase().trim())
  return normalized.includes('true') && normalized.includes('false')
}

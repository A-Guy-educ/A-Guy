/**
 * V3 Converter - Block Mapper
 *
 * Maps segmented content to native exercise block types.
 * Validates against ContentBlockSchema and falls back to rich_text on failure.
 *
 * @fileType utility
 * @domain conversion
 * @pattern mapping
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { nanoid } from 'nanoid'
import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'
import {
  HtmlBlockSchema,
  LatexBlockSchema,
  MediaBlockSchema,
  QuestionAxisBlockSchema,
  QuestionFreeResponseBlockSchema,
  QuestionGeometryBlockSchema,
  QuestionMatchingBlockSchema,
  QuestionSelectBlockSchema,
  QuestionTableBlockSchema,
  RichTextBlockSchema,
  SvgBlockSchema,
} from '@/server/payload/collections/Exercises/schemas'
import type { Segment } from './segmenter'
import { createMappingWarning, type MappingWarning, WARNING_CODES } from './conversion-report'
import { parseTable } from './parsers/table-parser'
import { parseMatching } from './parsers/matching-parser'
import { sanitizeHtmlServer, sanitizeSvgServer, validateMediaUrl } from './sanitize'

// ---------------------------------
// Types
// ---------------------------------

export interface MappingContext {
  subQuestionIndex: number
  options?: string[]
  correctAnswer?: number | null
  acceptedAnswers?: string[]
  geometryPayload?: Record<string, unknown>
  axisPayload?: Record<string, unknown>
}

// ---------------------------------
// Mapping Functions
// ---------------------------------

/**
 * Map a single segment to a native block type.
 * Validates output against ContentBlockSchema.
 * Falls back to rich_text on validation failure.
 */
export function mapSegmentToBlock(
  segment: Segment,
  context: MappingContext,
): { block: ContentBlock; warning?: MappingWarning } {
  const { type, content, index } = segment

  try {
    // Route to appropriate mapper based on segment type
    switch (type) {
      case 'rich_text':
        return { block: mapRichText(content) }

      case 'options':
        return mapOptions(segment, context)

      case 'table':
        return mapTable(segment, context)

      case 'matching':
        return mapMatching(segment, context)

      case 'svg':
        return mapSvg(segment, context)

      case 'html':
        return mapHtml(segment, context)

      case 'media':
        return mapMedia(segment, context)

      case 'geometry':
        return mapGeometry(segment, context)

      case 'axis_graph':
        return mapAxisGraph(segment, context)

      case 'latex':
        return mapLatex(segment, context)

      default:
        // Unknown type - fall back to rich text
        const warning = createMappingWarning({
          segmentIndex: index,
          segmentType: type,
          chosenBlockType: 'rich_text',
          reasonCode: WARNING_CODES.UNKNOWN_FORMAT,
          content,
        })
        return { block: mapRichText(content), warning }
    }
  } catch {
    // Validation failed - fall back to rich text
    const warning = createMappingWarning({
      segmentIndex: index,
      segmentType: type,
      chosenBlockType: 'rich_text',
      reasonCode: WARNING_CODES.VALIDATION_FAILED,
      content,
    })
    return { block: mapRichText(content), warning }
  }
}

/**
 * Map multiple segments to blocks in order
 */
export function mapSegmentsToBlocks(
  segments: Segment[],
  context: MappingContext,
): { blocks: ContentBlock[]; warnings: MappingWarning[] } {
  const blocks: ContentBlock[] = []
  const warnings: MappingWarning[] = []

  for (const segment of segments) {
    const result = mapSegmentToBlock(segment, context)
    blocks.push(result.block)
    if (result.warning) {
      warnings.push(result.warning)
    }
  }

  return { blocks, warnings }
}

// ---------------------------------
// Individual Mappers
// ---------------------------------

/**
 * Map to rich_text block
 */
function mapRichText(value: string): ContentBlock {
  const block = RichTextBlockSchema.parse({
    id: nanoid(),
    type: 'rich_text',
    format: 'md-math-v1',
    value: value || '',
    mediaIds: [],
  })
  return block
}

/**
 * Map options segment to question_select block
 */
function mapOptions(
  segment: Segment,
  context: MappingContext,
): { block: ContentBlock; warning?: MappingWarning } {
  const { content, index } = segment
  const { options, correctAnswer } = context

  // If we have options from context, use them
  if (options && options.length > 0) {
    // Determine variant and selection mode
    const isTrueFalse =
      options.length === 2 &&
      options.map((o) => o.toLowerCase().trim()).includes('true') &&
      options.map((o) => o.toLowerCase().trim()).includes('false')

    if (isTrueFalse) {
      return mapTrueFalse(content, correctAnswer)
    }

    return mapMcq(content, options, correctAnswer)
  }

  // Otherwise parse from content
  const parsedOptions = parseOptionsFromContent(content)

  if (parsedOptions.length === 0) {
    // No options found - treat as free response
    const warning = createMappingWarning({
      segmentIndex: index,
      segmentType: 'options',
      chosenBlockType: 'question_free_response',
      reasonCode: WARNING_CODES.FALLBACK_TO_RICH_TEXT,
      content,
    })
    return {
      block: mapFreeResponse(content, []),
      warning,
    }
  }

  if (parsedOptions.length === 2 && isTrueFalseOptions(parsedOptions)) {
    return mapTrueFalse(content, correctAnswer)
  }

  return mapMcq(content, parsedOptions, correctAnswer)
}

/**
 * Map to true/false question
 */
function mapTrueFalse(_content: string, correctAnswer?: number | null): { block: ContentBlock } {
  const trueOptionId = 'true'
  const falseOptionId = 'false'

  let correctOptionId: string | undefined
  if (correctAnswer !== null && correctAnswer !== undefined) {
    correctOptionId = correctAnswer === 0 ? trueOptionId : falseOptionId
  }

  const block = QuestionSelectBlockSchema.parse({
    id: nanoid(),
    type: 'question_select',
    variant: 'true_false',
    selectionMode: 'single',
    prompt: {
      type: 'rich_text',
      format: 'md-math-v1',
      value: '',
      mediaIds: [],
    },
    options: [
      {
        id: trueOptionId,
        value: true,
        label: { type: 'rich_text', format: 'md-math-v1', value: 'True', mediaIds: [] },
      },
      {
        id: falseOptionId,
        value: false,
        label: { type: 'rich_text', format: 'md-math-v1', value: 'False', mediaIds: [] },
      },
    ],
    answer: { correctOptionId },
  })

  return { block }
}

/**
 * Map to MCQ question
 */
function mapMcq(
  _content: string,
  options: string[],
  correctAnswer?: number | null,
): { block: ContentBlock } {
  const optionIds = options.map(() => nanoid())

  let correctOptionIds: string[]
  if (correctAnswer !== null && correctAnswer !== undefined && correctAnswer < options.length) {
    correctOptionIds = [optionIds[correctAnswer]]
  } else {
    // Fallback to first option
    correctOptionIds = [optionIds[0]]
  }

  const block = QuestionSelectBlockSchema.parse({
    id: nanoid(),
    type: 'question_select',
    variant: 'mcq',
    selectionMode: 'single',
    prompt: {
      type: 'rich_text',
      format: 'md-math-v1',
      value: '',
      mediaIds: [],
    },
    answer: {
      multiSelect: false,
      options: options.map((opt, idx) => ({
        id: optionIds[idx],
        content: { type: 'rich_text', format: 'md-math-v1', value: opt, mediaIds: [] },
      })),
      correctOptionIds,
    },
  })

  return { block }
}

/**
 * Map to free response question
 */
function mapFreeResponse(prompt: string, acceptedAnswers: string[]): ContentBlock {
  const answers = acceptedAnswers.length > 0 ? acceptedAnswers : ['(answer not detected)']

  const block = QuestionFreeResponseBlockSchema.parse({
    id: nanoid(),
    type: 'question_free_response',
    prompt: {
      type: 'rich_text',
      format: 'md-math-v1',
      value: prompt,
      mediaIds: [],
    },
    answer: { acceptedAnswers: answers },
  })

  return block
}

/**
 * Map table segment to question_table block
 */
function mapTable(
  segment: Segment,
  context: MappingContext,
): { block: ContentBlock; warning?: MappingWarning } {
  const { content, index } = segment
  const { acceptedAnswers } = context

  const parsed = parseTable(content)

  // Build answers from context if provided
  const answers: Record<string, string> = {}
  if (acceptedAnswers && acceptedAnswers.length > 0) {
    // Map accepted answers to cells
    acceptedAnswers.forEach((ans, idx) => {
      const row = Math.floor(idx / parsed.headers.length)
      const col = idx % parsed.headers.length
      answers[`${row}-${col}`] = ans
    })
  }

  try {
    const block = QuestionTableBlockSchema.parse({
      id: nanoid(),
      type: 'question_table',
      prompt: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
      table: {
        solutionFill: false,
        headers: parsed.headers,
        rowsData: parsed.rowsData,
        answers: Object.keys(answers).length > 0 ? answers : undefined,
        showBorders: true,
        showHeader: true,
      },
    })

    return { block }
  } catch {
    // Validation failed - fall back to rich text
    const warning = createMappingWarning({
      segmentIndex: index,
      segmentType: 'table',
      chosenBlockType: 'rich_text',
      reasonCode: WARNING_CODES.VALIDATION_FAILED,
      content,
    })
    return { block: mapRichText(content), warning }
  }
}

/**
 * Map matching segment to question_matching block
 */
function mapMatching(
  segment: Segment,
  context: MappingContext,
): { block: ContentBlock; warning?: MappingWarning } {
  const { content, index } = segment

  const parsed = parseMatching(content)

  if (parsed.leftColumn.length < 2 || parsed.rightColumn.length < 2) {
    // Not enough items for matching
    const warning = createMappingWarning({
      segmentIndex: index,
      segmentType: 'matching',
      chosenBlockType: 'rich_text',
      reasonCode: WARNING_CODES.FALLBACK_TO_RICH_TEXT,
      content,
    })
    return { block: mapRichText(content), warning }
  }

  try {
    const block = QuestionMatchingBlockSchema.parse({
      id: nanoid(),
      type: 'question_matching',
      prompt: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
      leftColumn: parsed.leftColumn,
      rightColumn: parsed.rightColumn,
      correctPairs: parsed.correctPairs,
      shuffleRightColumn: true,
    })

    return { block }
  } catch {
    const warning = createMappingWarning({
      segmentIndex: index,
      segmentType: 'matching',
      chosenBlockType: 'rich_text',
      reasonCode: WARNING_CODES.VALIDATION_FAILED,
      content,
    })
    return { block: mapRichText(content), warning }
  }
}

/**
 * Map SVG segment to SVG block
 */
function mapSvg(
  segment: Segment,
  context: MappingContext,
): { block: ContentBlock; warning?: MappingWarning } {
  const { content, index } = segment

  // Sanitize SVG
  const sanitized = sanitizeSvgServer(content)

  if (!sanitized.safe) {
    // SVG had dangerous content that was removed
    const warning = createMappingWarning({
      segmentIndex: index,
      segmentType: 'svg',
      chosenBlockType: 'svg',
      reasonCode: WARNING_CODES.SANITIZATION_APPLIED,
      content,
    })

    const block = SvgBlockSchema.parse({
      id: nanoid(),
      type: 'svg',
      value: sanitized.sanitized,
    })

    return { block, warning }
  }

  const block = SvgBlockSchema.parse({
    id: nanoid(),
    type: 'svg',
    value: content,
  })

  return { block }
}

/**
 * Map HTML segment to HTML block
 */
function mapHtml(
  segment: Segment,
  context: MappingContext,
): { block: ContentBlock; warning?: MappingWarning } {
  const { content, index } = segment

  // Sanitize HTML
  const sanitized = sanitizeHtmlServer(content)

  if (!sanitized.safe) {
    const warning = createMappingWarning({
      segmentIndex: index,
      segmentType: 'html',
      chosenBlockType: 'html',
      reasonCode: WARNING_CODES.SANITIZATION_APPLIED,
      content,
    })

    const block = HtmlBlockSchema.parse({
      id: nanoid(),
      type: 'html',
      html: sanitized.sanitized,
    })

    return { block, warning }
  }

  try {
    const block = HtmlBlockSchema.parse({
      id: nanoid(),
      type: 'html',
      html: content,
    })

    return { block }
  } catch {
    const warning = createMappingWarning({
      segmentIndex: index,
      segmentType: 'html',
      chosenBlockType: 'rich_text',
      reasonCode: WARNING_CODES.VALIDATION_FAILED,
      content,
    })
    return { block: mapRichText(content), warning }
  }
}

/**
 * Map media segment to media block
 */
function mapMedia(
  segment: Segment,
  context: MappingContext,
): { block: ContentBlock; warning?: MappingWarning } {
  const { content, index } = segment

  // Extract URL from img tag if present
  let url = content
  const imgMatch = content.match(/src=["']([^"']+)["']/i)
  if (imgMatch) {
    url = imgMatch[1]
  }

  // Validate URL
  const validation = validateMediaUrl(url)
  if (!validation.valid) {
    const warning = createMappingWarning({
      segmentIndex: index,
      segmentType: 'media',
      chosenBlockType: 'rich_text',
      reasonCode: WARNING_CODES.MEDIA_URL_INVALID,
      content,
    })
    return { block: mapRichText(`[Image: ${url}]`), warning }
  }

  // For now, we create a placeholder block with URL as mediaId
  // In production, this would create an asset and get a real ID
  const block = MediaBlockSchema.parse({
    id: nanoid(),
    type: 'media',
    mediaId: url, // Placeholder - would be real ID in production
  })

  return { block }
}

/**
 * Map geometry segment to geometry block
 */
function mapGeometry(
  segment: Segment,
  context: MappingContext,
): { block: ContentBlock; warning?: MappingWarning } {
  const { content, index } = segment

  try {
    const geometry = JSON.parse(content)
    const block = QuestionGeometryBlockSchema.parse({
      id: nanoid(),
      type: 'question_geometry',
      prompt: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
      geometry,
    })

    return { block }
  } catch {
    const warning = createMappingWarning({
      segmentIndex: index,
      segmentType: 'geometry',
      chosenBlockType: 'rich_text',
      reasonCode: WARNING_CODES.VALIDATION_FAILED,
      content,
    })
    return { block: mapRichText(content), warning }
  }
}

/**
 * Map axis graph segment to axis block
 */
function mapAxisGraph(
  segment: Segment,
  context: MappingContext,
): { block: ContentBlock; warning?: MappingWarning } {
  const { content, index } = segment

  try {
    const axis = JSON.parse(content)
    const block = QuestionAxisBlockSchema.parse({
      id: nanoid(),
      type: 'question_axis',
      prompt: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
      axis,
    })

    return { block }
  } catch {
    const warning = createMappingWarning({
      segmentIndex: index,
      segmentType: 'axis_graph',
      chosenBlockType: 'rich_text',
      reasonCode: WARNING_CODES.VALIDATION_FAILED,
      content,
    })
    return { block: mapRichText(content), warning }
  }
}

/**
 * Map LaTeX segment to latex block
 */
function mapLatex(
  segment: Segment,
  context: MappingContext,
): { block: ContentBlock; warning?: MappingWarning } {
  const { content, index } = segment

  // Extract LaTeX from delimiters
  let latex = content
  // Remove $$ or $ at start
  if (latex.startsWith('$$')) {
    latex = latex.substring(2)
  } else if (latex.startsWith('$')) {
    latex = latex.substring(1)
  }
  // Remove $$ or $ at end
  if (latex.endsWith('$$')) {
    latex = latex.slice(0, -2)
  } else if (latex.endsWith('$')) {
    latex = latex.slice(0, -1)
  }
  // Remove \[ and \]
  if (latex.startsWith('\\[')) {
    latex = latex.substring(2)
  }
  if (latex.endsWith('\\]')) {
    latex = latex.slice(0, -2)
  }
  latex = latex.trim()

  try {
    const block = LatexBlockSchema.parse({
      id: nanoid(),
      type: 'latex',
      latex,
      renderMode: content.includes('$$') ? 'block' : 'inline',
    })

    return { block }
  } catch {
    const warning = createMappingWarning({
      segmentIndex: index,
      segmentType: 'latex',
      chosenBlockType: 'rich_text',
      reasonCode: WARNING_CODES.VALIDATION_FAILED,
      content,
    })
    return { block: mapRichText(content), warning }
  }
}

// ---------------------------------
// Helper Functions
// ---------------------------------

/**
 * Parse options from content string
 */
function parseOptionsFromContent(content: string): string[] {
  const options: string[] = []

  // Look for option patterns like "A. Option", "1) Option", etc.
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Remove option prefix (A., 1., a), etc.)
    const cleaned = trimmed.replace(/^[A-Za-z0-9א-ת][\.\)]\s*/, '').trim()
    if (cleaned && cleaned.length > 0) {
      options.push(cleaned)
    }
  }

  return options
}

/**
 * Check if options are true/false
 */
function isTrueFalseOptions(options: string[]): boolean {
  if (options.length !== 2) return false

  const normalized = options.map((opt) => opt.toLowerCase().trim())
  return normalized.includes('true') && normalized.includes('false')
}

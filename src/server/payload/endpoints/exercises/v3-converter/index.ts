/**
 * V3 Converter - Enhanced Converter Orchestrator
 *
 * Provides enhanced conversion logic with content segmentation and block mapping.
 * This is the main entry point for the enhanced V3 converter.
 *
 * @fileType service
 * @domain conversion
 * @pattern orchestrator
 */

import type { ContentBlock, ExerciseContent } from '@/server/payload/collections/Exercises/schemas'
import { ContentSchema } from '@/server/payload/collections/Exercises/schemas'
import { normalizeExtraction, type NormalizedSubQuestion } from './normalize'
import { segmentContent } from './segmenter'
import { mapSegmentsToBlocks, type MappingContext } from './block-mapper'
import {
  createConversionReport,
  type ConversionReport,
  type MappingWarning,
} from './conversion-report'
import { RichTextBlockSchema } from '@/server/payload/collections/Exercises/schemas'

// Re-export from transform for backward compatibility
export {
  type SubQuestionExtraction,
  type MultiPartExtraction,
  type SubQuestionDraft,
  type MultiPartPreviewDraft,
  type PreviewDraft,
  type TransformResult,
} from '@/server/services/exercise-conversion/v3/transform'

// ---------------------------------
// Types
// ---------------------------------

export interface EnhancedTransformResult {
  title: string
  content: ExerciseContent
  report: ConversionReport
}

export interface EnhancedSubQuestionResult {
  blocks: ContentBlock[]
  warnings: MappingWarning[]
}

// ---------------------------------
// Main Conversion Functions
// ---------------------------------

/**
 * Enhanced conversion of a sub-question with segmentation.
 * Uses content analysis to detect and map multiple block types.
 */
export function enhancedCreateQuestionBlocks(
  sq: NormalizedSubQuestion,
  subQuestionIndex: number,
): EnhancedSubQuestionResult {
  const warnings: MappingWarning[] = []

  // Segment the prompt content
  const segments = segmentContent(sq.prompt)

  // Build mapping context
  const context: MappingContext = {
    subQuestionIndex,
    options: sq.options,
    correctAnswer: sq.correctAnswer,
    acceptedAnswers: sq.acceptedAnswers,
    geometryPayload: sq.geometryPayload,
    axisPayload: sq.axisPayload,
  }

  // Map segments to blocks
  const { blocks, warnings: segmentWarnings } = mapSegmentsToBlocks(segments, context)
  warnings.push(...segmentWarnings)

  // If no blocks were created, add a rich text block with the prompt
  if (blocks.length === 0) {
    blocks.push(
      RichTextBlockSchema.parse({
        id: `sq_${subQuestionIndex}_fallback`,
        type: 'rich_text',
        format: 'md-math-v1',
        value: sq.prompt || '',
        mediaIds: [],
      }),
    )
  }

  return { blocks, warnings }
}

/**
 * Enhanced multi-part extraction to exercise content with full conversion report.
 */
export function enhancedMultiPartToExerciseContent(
  extraction: {
    title?: string
    stem?: string
    subQuestions: NormalizedSubQuestion[]
    diagramDescription?: string
    diagramPosition?: 'before_question' | 'after_question'
  },
  correlationId: string,
): EnhancedTransformResult {
  const startTime = Date.now()
  const blocks: ContentBlock[] = []
  const allWarnings: MappingWarning[] = []
  const detectedFeatures: string[] = []
  const blockTypes: string[] = []

  // Normalize the extraction
  const normalized = normalizeExtraction({
    title: extraction.title,
    stem: extraction.stem,
    subQuestions: extraction.subQuestions.map((sq) => ({
      prompt: sq.prompt,
      type: sq.type,
      options: sq.options,
      correctAnswer: sq.correctAnswer,
      acceptedAnswers: sq.acceptedAnswers,
      diagramDescription: sq.diagramDescription,
    })),
    diagramDescription: extraction.diagramDescription,
    diagramPosition: extraction.diagramPosition,
  })

  // Process stem if present
  if (normalized.stem?.trim()) {
    blocks.push(
      RichTextBlockSchema.parse({
        id: 'stem_block',
        type: 'rich_text',
        format: 'md-math-v1',
        value: normalized.stem,
        mediaIds: [],
      }),
    )
    detectedFeatures.push('stem_rich_text')
    blockTypes.push('rich_text')
  }

  // Process each sub-question
  for (let i = 0; i < normalized.subQuestions.length; i++) {
    const sq = normalized.subQuestions[i]
    const result = enhancedCreateQuestionBlocks(sq, i)
    blocks.push(...result.blocks)
    allWarnings.push(...result.warnings)

    // Track features
    if (sq.options && sq.options.length > 0) {
      detectedFeatures.push(`subq_${i}_options`)
      blockTypes.push('question_select')
    } else {
      detectedFeatures.push(`subq_${i}_free_response`)
      blockTypes.push('question_free_response')
    }
  }

  // Derive title
  const title =
    normalized.title ||
    normalized.stem ||
    normalized.subQuestions[0]?.prompt?.substring(0, 77) + '...' ||
    'Untitled Exercise'

  // Validate content
  const content: ExerciseContent = { blocks }
  const validationResult = ContentSchema.safeParse(content)

  if (!validationResult.success) {
    // If validation fails, fall back to rich text for all blocks
    const fallbackBlocks: ContentBlock[] = []

    // Add stem as rich text
    if (normalized.stem?.trim()) {
      fallbackBlocks.push(
        RichTextBlockSchema.parse({
          id: 'stem_fallback',
          type: 'rich_text',
          format: 'md-math-v1',
          value: normalized.stem,
          mediaIds: [],
        }),
      )
    }

    // Add each sub-question as rich text
    for (let i = 0; i < normalized.subQuestions.length; i++) {
      const sq = normalized.subQuestions[i]
      fallbackBlocks.push(
        RichTextBlockSchema.parse({
          id: `sq_${i}_fallback`,
          type: 'rich_text',
          format: 'md-math-v1',
          value: sq.prompt || '',
          mediaIds: [],
        }),
      )
    }

    // Add validation warning
    allWarnings.push({
      segmentIndex: -1,
      segmentType: 'rich_text',
      chosenBlockType: 'rich_text',
      reasonCode: 'VALIDATION_FAILED',
      fingerprint: 'validation_error',
    })

    // Return with fallback content
    const report = createConversionReport({
      correlationId,
      segmentCount: fallbackBlocks.length,
      detectedFeatures,
      blockTypes: ['rich_text'],
      warnings: allWarnings,
      processingTimeMs: Date.now() - startTime,
    })

    return {
      title,
      content: { blocks: fallbackBlocks },
      report,
    }
  }

  // Create report
  const report = createConversionReport({
    correlationId,
    segmentCount: blocks.length,
    detectedFeatures,
    blockTypes,
    warnings: allWarnings,
    processingTimeMs: Date.now() - startTime,
  })

  return { title, content, report }
}

/**
 * Simple conversion function for backward compatibility.
 * Delegates to the existing transform logic for simple cases.
 */
export function enhancedSimpleToExerciseContent(
  extraction: {
    question: string
    options?: string[]
    correctAnswer?: number | null
    acceptedAnswer?: string
    diagramDescription?: string
  },
  correlationId: string,
): EnhancedTransformResult {
  // Determine type
  let type: 'free_response' | 'mcq' | 'true_false' = 'free_response'
  if (extraction.options && extraction.options.length > 0) {
    if (
      extraction.options.length === 2 &&
      extraction.options.map((o) => o.toLowerCase().trim()).includes('true') &&
      extraction.options.map((o) => o.toLowerCase().trim()).includes('false')
    ) {
      type = 'true_false'
    } else {
      type = 'mcq'
    }
  }

  // Normalize to multi-part format
  const multiPart = {
    title: extraction.question.substring(0, 77) + '...',
    stem: undefined,
    subQuestions: [
      {
        prompt: extraction.question,
        type,
        options: extraction.options,
        correctAnswer: extraction.correctAnswer,
        acceptedAnswers: extraction.acceptedAnswer ? [extraction.acceptedAnswer] : undefined,
        diagramDescription: extraction.diagramDescription,
        unknownPayload: {},
      },
    ],
    diagramDescription: undefined,
    diagramPosition: undefined,
  }

  return enhancedMultiPartToExerciseContent(multiPart, correlationId)
}

// ---------------------------------
// Utility Exports
// ---------------------------------

export { segmentContent } from './segmenter'
export { mapSegmentsToBlocks, mapSegmentToBlock } from './block-mapper'
export { detectFeatures } from './content-analyzer'
export { normalizeExtraction, normalizeSubQuestion } from './normalize'
export { createConversionReport, createMappingWarning, WARNING_CODES } from './conversion-report'
export type { Segment, SegmentType } from './segmenter'
export type { MappingWarning, ConversionReport } from './conversion-report'
export type { MappingContext } from './block-mapper'

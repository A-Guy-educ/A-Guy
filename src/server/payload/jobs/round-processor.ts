/**
 * Round Processor - Multi-round extraction/enrichment for exercises
 *
 * Processes additional AI rounds per exercise after initial extraction.
 * Each round can enrich exercises with additional data (diagrams, hints, etc.)
 */

import type { Payload } from 'payload'
import type { EnrichmentResult, ExtractionRound, JobLogEntry, JobStage } from './types'

// -------------------------------------
// Trigger Condition Types
// -------------------------------------

type TriggerCondition = 'always' | 'has_image' | 'has_table' | 'has_diagram' | 'custom'

// -------------------------------------
// Interface
// -------------------------------------

export interface ExtractedExercise {
  id: string
  title: string
  content: Record<string, unknown>
  // Exercise blocks from content
  blocks?: Array<{
    type: string
    [key: string]: unknown
  }>
}

export interface RoundProcessorInput {
  exercise: ExtractedExercise
  rounds: ExtractionRound[]
  pdfSegment?: Buffer
  logger?: {
    info: (stage: string, message: string, details?: Record<string, unknown>) => void
    warn: (stage: string, message: string, details?: Record<string, unknown>) => void
    error: (stage: string, message: string, details?: Record<string, unknown>) => void
  }
}

// -------------------------------------
// Processor
// -------------------------------------

/**
 * Process all rounds for an exercise
 */
export async function processRounds(
  payload: Payload,
  input: RoundProcessorInput,
): Promise<Record<string, EnrichmentResult>> {
  const enrichments: Record<string, EnrichmentResult> = {}
  const { exercise, rounds, pdfSegment, logger } = input

  // Sort rounds by order
  const sortedRounds = [...rounds].filter((r) => r.isEnabled).sort((a, b) => a.order - b.order)

  for (const round of sortedRounds) {
    // Check trigger condition
    const shouldRun = evaluateTrigger(round.triggerCondition, round.customCondition, exercise)

    if (!shouldRun) {
      logger?.info('ROUND_PROCESSING', `Skipping round "${round.name}" - trigger not met`, {
        condition: round.triggerCondition,
      })
      continue
    }

    logger?.info('ROUND_PROCESSING', `Running round "${round.name}"`, {
      targetField: round.targetField,
    })

    try {
      const result = await executeRound(payload, round, exercise, pdfSegment)

      enrichments[round.targetField] = {
        roundId: round.id,
        roundName: round.name,
        extractedAt: new Date().toISOString(),
        promptHash: round.promptSnapshot?.hash || '',
        data: result,
      }

      logger?.info('ROUND_PROCESSING', `Round "${round.name}" completed`, {
        resultKeys: Object.keys(result),
      })
    } catch (error) {
      logger?.warn('ROUND_PROCESSING', `Round "${round.name}" failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Continue with other rounds - don't fail the whole exercise
    }
  }

  return enrichments
}

// -------------------------------------
// Trigger Evaluation
// -------------------------------------

function evaluateTrigger(
  condition: TriggerCondition,
  customCondition: string | undefined,
  exercise: ExtractedExercise,
): boolean {
  switch (condition) {
    case 'always':
      return true

    case 'has_image':
      return hasImageBlock(exercise)

    case 'has_table':
      return hasTableContent(exercise)

    case 'has_diagram':
      return hasDiagramContent(exercise)

    case 'custom':
      return evaluateCustomCondition(customCondition || '', exercise)

    default:
      return false
  }
}

function hasImageBlock(exercise: ExtractedExercise): boolean {
  // Check content blocks for images
  if (exercise.blocks) {
    return exercise.blocks.some((block) => block.type === 'image')
  }
  // Check content object
  const content = exercise.content
  if (content && typeof content === 'object') {
    const blocks = (content as Record<string, unknown>).blocks
    if (Array.isArray(blocks)) {
      return blocks.some(
        (block) =>
          typeof block === 'object' &&
          block !== null &&
          (block as Record<string, unknown>).type === 'image',
      )
    }
  }
  return false
}

function hasTableContent(exercise: ExtractedExercise): boolean {
  // Check for table-related content
  const contentStr = JSON.stringify(exercise.content).toLowerCase()
  return (
    contentStr.includes('table') || contentStr.includes('tabular') || contentStr.includes('grid')
  )
}

function hasDiagramContent(exercise: ExtractedExercise): boolean {
  // Check for diagram/image with caption containing diagram keywords
  const contentStr = JSON.stringify(exercise.content).toLowerCase()
  const diagramKeywords = ['diagram', 'chart', 'graph', 'triangle', 'circle', 'geometric', 'shape']
  return diagramKeywords.some((keyword) => contentStr.includes(keyword))
}

function evaluateCustomCondition(_condition: string, _exercise: ExtractedExercise): boolean {
  // TODO: Implement JSONPath evaluation if needed
  // For now, always return true for custom conditions
  // This could use a JSONPath library like 'jsonpath-plus'
  return true
}

// -------------------------------------
// Round Execution
// -------------------------------------

async function executeRound(
  payload: Payload,
  round: ExtractionRound,
  exercise: ExtractedExercise,
  _pdfSegment: Buffer | undefined,
): Promise<Record<string, unknown>> {
  // Get the prompt template
  const promptTemplate = round.promptSnapshot?.template

  if (!promptTemplate) {
    throw new Error(`Round "${round.name}" has no prompt snapshot`)
  }

  // Prepare the prompt with exercise context
  const exerciseContext = JSON.stringify(exercise.content, null, 2)
  const prompt = promptTemplate
    .replace('{{exercise_content}}', exerciseContext)
    .replace('{{exercise_title}}', exercise.title)

  // Call the LLM to get enrichment
  // Note: This should use the existing LLM infrastructure
  // The actual implementation depends on how LLMs are called in this codebase

  // Placeholder - would call the LLM service
  const result = await callLLM(prompt, {
    roundName: round.name,
    exerciseId: exercise.id,
  })

  return result
}

async function callLLM(
  prompt: string,
  metadata: { roundName: string; exerciseId: string },
): Promise<Record<string, unknown>> {
  // TODO: Implement actual LLM call
  // This should integrate with the existing LLM infrastructure
  // For now, return a placeholder result

  console.log(`[Round Processor] Calling LLM for ${metadata.roundName}`, {
    promptLength: prompt.length,
    exerciseId: metadata.exerciseId,
  })

  // Placeholder return - would be replaced with actual LLM response parsing
  return {
    success: true,
    message: 'Round processing not fully implemented',
  }
}

// -------------------------------------
// Quality Score Calculation
// -------------------------------------

/**
 * Calculate quality scores for an extracted exercise
 */
export function calculateQualityScores(exercise: ExtractedExercise): {
  confidence: number
  completeness: number
  complexity: number
} {
  // Confidence: Based on available content
  const confidence = calculateConfidence(exercise)

  // Completeness: Required fields present
  const completeness = calculateCompleteness(exercise)

  // Complexity: Estimated difficulty
  const complexity = calculateComplexity(exercise)

  return { confidence, completeness, complexity }
}

function calculateConfidence(exercise: ExtractedExercise): number {
  // Simple heuristic - can be enhanced
  const content = exercise.content
  if (!content || typeof content !== 'object') {
    return 0.5
  }

  const contentStr = JSON.stringify(content)
  const length = contentStr.length

  if (length < 100) return 0.6
  if (length < 500) return 0.7
  if (length < 2000) return 0.8
  return 0.9
}

function calculateCompleteness(exercise: ExtractedExercise): number {
  // Check for required fields
  const required = ['title', 'content']
  const present: string[] = []

  if (exercise.title) present.push('title')
  if (exercise.content && Object.keys(exercise.content).length > 0) {
    present.push('content')
  }

  return present.length / required.length
}

function calculateComplexity(exercise: ExtractedExercise): number {
  // Factors: block count, math expressions, images, nested questions
  let score = 0
  const content = exercise.content

  if (content && typeof content === 'object') {
    const blocks = (content as Record<string, unknown>).blocks
    if (Array.isArray(blocks)) {
      score += Math.min(blocks.length / 10, 0.3)

      // Count question blocks
      const questionCount = blocks.filter(
        (b) =>
          typeof b === 'object' &&
          b !== null &&
          ['question', 'mcq', 'free_response', 'select'].includes(
            (b as Record<string, unknown>).type as string,
          ),
      ).length
      score += Math.min(questionCount * 0.1, 0.3)

      // Check for math/latex
      const hasLatex = blocks.some(
        (b) =>
          typeof b === 'object' && b !== null && (b as Record<string, unknown>).type === 'latex',
      )
      if (hasLatex) score += 0.2

      // Check for images
      const hasImage = blocks.some(
        (b) =>
          typeof b === 'object' && b !== null && (b as Record<string, unknown>).type === 'image',
      )
      if (hasImage) score += 0.2
    }
  }

  return Math.min(score, 1)
}

// -------------------------------------
// Log Entry Factory
// -------------------------------------

export function createLogEntry(
  stage: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  details?: Record<string, unknown>,
): JobLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    stage: stage as JobStage,
    message,
    details,
  }
}

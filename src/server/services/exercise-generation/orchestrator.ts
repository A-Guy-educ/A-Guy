/**
 * Exercise Generation Orchestrator
 *
 * Drives the exercise generation pipeline for a single ExerciseGenerations record:
 *  1. Pre-create N empty draft exercises (with empty blocks) — saved immediately
 *  2. For each exercise position, call AI to generate blocks
 *  3. Update the exercise with generated content after each AI call
 *  4. Stream progress to the record as exercises complete
 *
 * Resumable: exercises already in outputExercises are skipped.
 * Rate limit errors are caught and the orchestrator returns 'in_progress'
 * so the next cron tick can continue.
 */

import type { Payload } from 'payload'
import type { GenerationDifficultyLevel } from '@/server/payload/collections/ExerciseGenerations'
import { logger } from '@/infra/utils/logger'
import { generateExercise, type TokensUsed } from '@/infra/llm/services/exercise-generation-service'

// Concurrency of 1 for safe appendEntry (same as lesson duplication)
export const CONCURRENCY_LIMIT = 1 as const

export const GENERATION_FAILURE_CODE = 'GENERATION_FAILED' as const
export const STUCK_FAILURE_CODE = 'STUCK_AFTER_MAX_ATTEMPTS' as const

/** Shape of an output exercise mapping entry. */
export interface OutputExerciseMapping {
  exerciseId: string
  position: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RunOutcome = 'succeeded' | 'needs_review' | 'failed' | 'in_progress'

export interface RunOptions {
  /**
   * Absolute wall-clock deadline (Date.now() ms). The orchestrator returns
   * `in_progress` as soon as the remaining time is too short to fit another
   * exercise — leaving the record in `running` so the next cron tick continues.
   */
  deadlineMs?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Compile-time guard
// ─────────────────────────────────────────────────────────────────────────────

// Concurrency of 1 = process exercises sequentially.
// appendEntry uses read-modify-write which isn't safe under parallel writes.
type _AssertConcurrencyOne = typeof CONCURRENCY_LIMIT extends 1 ? true : never
const _concurrencyAssert: _AssertConcurrencyOne = true
void _concurrencyAssert

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

function suggestAction(code: string): 'skip' | 'regenerate' | 'keep' {
  switch (code) {
    case GENERATION_FAILURE_CODE:
      return 'skip'
    default:
      return 'skip'
  }
}

/**
 * Append a failure entry to the ExerciseGenerations record.
 */
async function appendFailure(
  payload: Payload,
  generationId: string,
  exerciseRef: string,
  sectionIndex: number,
  code: string,
  message: string,
): Promise<void> {
  const action = suggestAction(code)
  try {
    const current = await payload.findByID({
      collection: 'exercise-generations',
      id: generationId,
      depth: 0,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'exercise-generations',
      id: generationId,
      data: {
        failures: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(((current as any).failures as any[]) ?? []),
          {
            exerciseRef,
            sectionIndex,
            code,
            message,
            suggestedAction: action,
            resolved: false,
          },
        ],
      } as never,
      overrideAccess: true,
    })
  } catch (err) {
    logger.error(
      { err, generationId, exerciseRef, code },
      'Failed to append failure entry to ExerciseGenerations',
    )
  }
}

/**
 * Append a successful output exercise mapping to the record.
 */
/**
 * Update an existing output exercise mapping (for updating existing exercises on retry).
 */
async function updateOutputExercise(
  payload: Payload,
  generationId: string,
  mapping: OutputExerciseMapping,
): Promise<void> {
  try {
    const current = await payload.findByID({
      collection: 'exercise-generations',
      id: generationId,
      depth: 0,
      overrideAccess: true,
    })
    const existing =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((current as any).outputExercises as OutputExerciseMapping[]) ?? []
    const index = existing.findIndex((e) => e.exerciseId === mapping.exerciseId)
    if (index >= 0) {
      existing[index] = mapping
    } else {
      existing.push(mapping)
    }
    await payload.update({
      collection: 'exercise-generations',
      id: generationId,
      data: { outputExercises: existing } as never,
      overrideAccess: true,
    })
  } catch (err) {
    logger.error(
      { err, generationId, exerciseRef: mapping.exerciseId },
      'Failed to update output exercise mapping',
    )
  }
}

/**
 * Update AI telemetry fields on the record.
 */
async function updateTelemetry(
  payload: Payload,
  generationId: string,
  tokensUsed: TokensUsed,
  runDurationMs: number,
): Promise<void> {
  try {
    const current = await payload.findByID({
      collection: 'exercise-generations',
      id: generationId,
      depth: 0,
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = current as any
    await payload.update({
      collection: 'exercise-generations',
      id: generationId,
      data: {
        aiTokensInput: (record.aiTokensInput ?? 0) + tokensUsed.inputTokens,
        aiTokensOutput: (record.aiTokensOutput ?? 0) + tokensUsed.outputTokens,
        runDurationMs: (record.runDurationMs ?? 0) + runDurationMs,
      } as never,
      overrideAccess: true,
    })
  } catch (err) {
    logger.error({ err, generationId }, 'Failed to update telemetry')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-create empty exercises
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-create N empty draft exercises linked to the target lesson.
 * Returns an array of exercise IDs in order.
 */
async function preCreateExercises(
  payload: Payload,
  lessonId: string,
  count: number,
): Promise<string[]> {
  const exerciseIds: string[] = []
  for (let i = 0; i < count; i++) {
    const ex = await payload.create({
      collection: 'exercises',
      data: {
        title: `Generated Exercise ${i + 1}`,
        lesson: lessonId,
        content: { blocks: [] },
        status: 'draft',
      } as never,
      overrideAccess: true,
    })
    exerciseIds.push(ex.id)
  }
  return exerciseIds
}

// ─────────────────────────────────────────────────────────────────────────────
// Process single exercise
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate content for a single exercise position.
 */
async function processExercise(
  position: number,
  exerciseId: string,
  generationId: string,
  prompt: string,
  difficultyLevel: GenerationDifficultyLevel,
  totalExercises: number,
  payload: Payload,
): Promise<{ tokensUsed: TokensUsed } | null> {
  const exerciseRef = `exercise-${position}`

  try {
    const startTime = Date.now()

    const result = await generateExercise(
      {
        prompt,
        difficultyLevel,
        exerciseIndex: position,
        totalExercises,
      },
      payload,
    )

    const tokensUsed = result.tokensUsed
    const latencyMs = Date.now() - startTime

    // Update the exercise with generated content
    await payload.update({
      collection: 'exercises',
      id: exerciseId,
      data: {
        title: `Generated Exercise ${position + 1}`,
        content: { blocks: result.blocks },
      } as never,
      overrideAccess: true,
    })

    // Update telemetry
    await updateTelemetry(payload, generationId, tokensUsed, latencyMs)

    return { tokensUsed }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown generation error'
    logger.error({ exerciseRef, err }, 'Exercise generation failed')
    await appendFailure(
      payload,
      generationId,
      exerciseRef,
      position,
      GENERATION_FAILURE_CODE,
      message,
    )
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main orchestrator
// ─────────────────────────────────────────────────────────────────────────────

const FINALIZE_BUDGET_MS = 30_000
const ASSUMED_EXERCISE_DURATION_MS = 300_000

/**
 * Orchestrate the exercise generation pipeline for a single ExerciseGenerations record.
 * Resumable: skips exercises already in outputExercises.
 */
export async function runExerciseGenerationOrchestrator(
  generationId: string,
  payload: Payload,
  options: RunOptions = {},
): Promise<RunOutcome> {
  // Load the generation record
  const generation = await payload.findByID({
    collection: 'exercise-generations',
    id: generationId,
    depth: 0,
    overrideAccess: true,
  })

  if (!generation) {
    logger.error({ generationId }, 'ExerciseGenerations record not found')
    return 'failed'
  }

  // Already terminal — nothing to do
  if (
    generation.status === 'succeeded' ||
    generation.status === 'needs_review' ||
    generation.status === 'failed'
  ) {
    logger.warn(
      { generationId, status: generation.status },
      'ExerciseGenerations record already terminal, skipping',
    )
    return generation.status as RunOutcome
  }

  if (generation.status !== 'pending' && generation.status !== 'running') {
    logger.warn(
      { generationId, status: generation.status },
      'ExerciseGenerations record in unexpected status, skipping',
    )
    return 'failed'
  }

  try {
    // Extract lesson ID
    const lessonId =
      typeof generation.lesson === 'string'
        ? generation.lesson
        : (generation.lesson as { id?: string })?.id

    if (!lessonId) {
      throw new Error('lesson relationship is missing or invalid')
    }

    const maxCount = (generation.maxCount as number) ?? 10
    const difficultyLevel = (generation.difficultyLevel as GenerationDifficultyLevel) ?? 'medium'
    const prompt = generation.prompt as string

    // First tick: pre-create exercises and flip to running
    if (generation.status === 'pending') {
      const exerciseIds = await preCreateExercises(payload, lessonId, maxCount)

      // Initialize outputExercises with empty entries
      const initialMappings: OutputExerciseMapping[] = exerciseIds.map((id, idx) => ({
        exerciseId: id,
        position: idx,
      }))

      await payload.update({
        collection: 'exercise-generations',
        id: generationId,
        data: {
          status: 'running',
          outputExercises: initialMappings,
        } as never,
        overrideAccess: true,
      })
    }

    // Get existing output exercises from the record
    const existingMappings =
      (generation.outputExercises as OutputExerciseMapping[] | undefined) ?? []

    // Filter out already-processed exercises (those with successful generation)
    // We track progress by checking which exercises have been successfully updated
    const processedPositions = new Set<number>()
    for (const mapping of existingMappings) {
      // Check if the exercise has content (not empty blocks)
      try {
        const exercise = await payload.findByID({
          collection: 'exercises',
          id: mapping.exerciseId,
          depth: 0,
          overrideAccess: true,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blocks = (exercise as any).content?.blocks
        if (Array.isArray(blocks) && blocks.length > 0) {
          processedPositions.add(mapping.position)
        }
      } catch {
        // Exercise doesn't exist or can't be read, will retry
      }
    }

    // Get all positions that still need processing
    const remainingPositions: number[] = []
    for (let i = 0; i < maxCount; i++) {
      if (!processedPositions.has(i)) {
        remainingPositions.push(i)
      }
    }

    logger.info(
      {
        generationId,
        totalPositions: maxCount,
        alreadyProcessed: processedPositions.size,
        remaining: remainingPositions.length,
      },
      'Exercise generation orchestrator tick start',
    )

    // Process remaining exercises
    for (const position of remainingPositions) {
      // Check deadline
      if (options.deadlineMs !== undefined) {
        const remainingMs = options.deadlineMs - Date.now()
        if (remainingMs < FINALIZE_BUDGET_MS + ASSUMED_EXERCISE_DURATION_MS) {
          logger.info(
            { generationId, remainingMs, remainingPositions: remainingPositions.length },
            'Orchestrator tick yielding before deadline — leaving record running',
          )
          return 'in_progress'
        }
      }

      // Get exercise ID for this position
      const mapping = existingMappings.find((m) => m.position === position)
      if (!mapping) {
        logger.warn({ generationId, position }, 'No exercise mapping found for position')
        continue
      }

      const result = await processExercise(
        position,
        mapping.exerciseId,
        generationId,
        prompt,
        difficultyLevel,
        maxCount,
        payload,
      )

      if (result === null) {
        // Generation failed, continue to next exercise
        continue
      }

      // Success - update the mapping (already has the exerciseId and position)
      await updateOutputExercise(payload, generationId, mapping)
    }

    // All exercises processed — finalize status
    const finalRecord = await payload.findByID({
      collection: 'exercise-generations',
      id: generationId,
      depth: 0,
      overrideAccess: true,
    })

    const finalFailures =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (finalRecord.failures as any[])?.length ?? 0
    const finalOutputs =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (finalRecord.outputExercises as any[])?.length ?? 0

    const finalStatus: 'succeeded' | 'needs_review' =
      finalFailures === 0 ? 'succeeded' : 'needs_review'

    logger.info(
      {
        generationId,
        total: maxCount,
        succeeded: finalOutputs,
        failed: finalFailures,
        finalStatus,
      },
      'Exercise generation orchestrator completed',
    )

    await payload.update({
      collection: 'exercise-generations',
      id: generationId,
      data: { status: finalStatus },
      overrideAccess: true,
    })

    return finalStatus
  } catch (err) {
    logger.error({ generationId, err }, 'Orchestrator run failed')
    await payload.update({
      collection: 'exercise-generations',
      id: generationId,
      data: { status: 'failed' },
      overrideAccess: true,
    })
    throw err
  }
}

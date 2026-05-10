/**
 * Lesson Duplication Orchestrator
 *
 * Drives the duplication pipeline for a single LessonDuplications record:
 *  1. K2: Select up to 20 exercises from source lesson (via selectExercisesScaled)
 *  2. For each exercise, concurrently (max 3):
 *     a. Route to strategy (script or AI) → generates new exercise content
 *     b. Run structural validator on the generated content
 *     c. If structural passes AND strategy != 'script', run semantic validator
 *     d. On any failure, append a failure entry to the LessonDuplications record
 *  3. After all exercises settle: set status=succeeded (0 failures) or needs_review (>0 failures)
 *
 * Failures are streamed live — each failure is written to the DB immediately
 * via payload.update(), not accumulated in memory.
 */

import type { Payload } from 'payload'
import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'
import { logger } from '@/infra/utils/logger'
import { withConcurrencyLimit } from '@/infra/utils/concurrency'
import { selectExercisesScaled } from '@/server/services/lesson-duplication/selectors'
import {
  validateExerciseStructural,
  type StructuralFailure,
} from '@/server/services/lesson-duplication/validators/structural'
import {
  validateExerciseSemantic,
  SEMANTIC_FAILURE_CODE,
} from '@/server/services/lesson-duplication/validators/semantic'

export const CONCURRENCY_LIMIT = 3

export const GENERATION_FAILURE_CODE = 'GENERATION_FAILED' as const

export type DuplicationStrategy = 'script' | 'ai'

/** Result of running the strategy for one exercise. */
export interface StrategyResult {
  exerciseId: string
  strategy: DuplicationStrategy
  blocks: ContentBlock[]
}

/**
 * Generate a new exercise via the appropriate strategy.
 *
 * STUB: This function is the K3/K4 plug-in point.
 * Currently throws unless overridden by tests via vi.mock.
 *
 * @param sourceExerciseId  ID of the source exercise to vary
 * @param level             Duplication level (light/medium/deep)
 * @param _payload          Payload instance (available for future use)
 * @returns                 StrategyResult with generated blocks and strategy used
 *
 * TODO: Replace with actual K3/K4 implementation
 */
export async function runStrategy(
  sourceExerciseId: string,
  level: 'none' | 'light' | 'medium' | 'deep',
  _payload: Payload,
): Promise<StrategyResult> {
  // STUB: In production, this would call the actual script or AI strategy.
  // For now, throw to indicate this must be implemented before use.
  throw new Error(
    `runStrategy is a K3/K4 stub — sourceExerciseId=${sourceExerciseId}, level=${level}. ` +
      'K3 (script strategy) and K4 (AI strategy) are not yet implemented. ' +
      'Until then, every non-none duplication will produce GENERATION_FAILED.',
  )
}

/** Suggested action for a failure, based on failure code. */
function suggestAction(code: string): 'skip' | 'regenerate' | 'keep' {
  switch (code) {
    case 'MISSING_QUESTION':
    case 'MISSING_HINT':
    case 'MISSING_SOLUTION':
    case 'MISSING_FULL_SOLUTION':
    case 'MISSING_CORRECT_OPTION':
    case 'MISSING_WRONG_OPTIONS':
    case 'INVALID_SVG':
    case 'PNG_FORBIDDEN':
    case 'TOO_MANY_SECTIONS':
      return 'regenerate'
    case 'SEMANTIC_MISMATCH':
      return 'regenerate'
    case 'GENERATION_FAILED':
      return 'skip'
    default:
      return 'skip'
  }
}

/** Append a single failure to the LessonDuplications record (live streaming). */
async function appendFailure(
  payload: Payload,
  duplicationId: string,
  exerciseRef: string,
  sectionIndex: number,
  code: string,
  message: string,
): Promise<void> {
  const action = suggestAction(code)
  try {
    // Read current failures and append
    const current = await payload.findByID({
      collection: 'lesson-duplications',
      id: duplicationId,
      depth: 0,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'lesson-duplications',
      id: duplicationId,
      data: {
        failures: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...((current.failures as any[]) ?? []),
          { exerciseRef, sectionIndex, code, message, suggestedAction: action },
        ],
      } as never,
      overrideAccess: true,
    })
  } catch (err) {
    logger.error(
      { err, duplicationId, exerciseRef, code },
      'Failed to append failure to LessonDuplications',
    )
    // Don't rethrow — failure streaming failure should not abort the run
  }
}

/** Shape of an exercise from the exercises collection. */
type ExerciseDoc = {
  id: string
  content?: { blocks?: ContentBlock[] }
}

/**
 * Process a single exercise through the duplication pipeline.
 *
 * Steps:
 *  1. Run strategy → get new exercise content
 *  2. Structural validation → collect failures
 *  3. If structural passes AND strategy != 'script' → semantic validation
 *  4. On any failure: stream failure to DB, return null
 *  5. On all pass: return StrategyResult for the orchestrator to use
 */
async function processExercise(
  exercise: ExerciseDoc,
  duplicationId: string,
  level: 'none' | 'light' | 'medium' | 'deep',
  payload: Payload,
): Promise<StrategyResult | null> {
  const exerciseRef = exercise.id

  // Step 1: Run strategy
  let strategyResult: StrategyResult
  try {
    strategyResult = await runStrategy(exercise.id, level, payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown strategy error'
    logger.error({ exerciseRef, level, err }, 'Strategy generation failed')
    await appendFailure(payload, duplicationId, exerciseRef, 0, GENERATION_FAILURE_CODE, message)
    return null
  }

  // Step 2: Structural validation
  const structuralFailures: StructuralFailure[] = validateExerciseStructural(strategyResult.blocks)
  if (structuralFailures.length > 0) {
    for (const failure of structuralFailures) {
      await appendFailure(
        payload,
        duplicationId,
        exerciseRef,
        failure.blockIndex ?? 0,
        failure.code,
        failure.message,
      )
    }
    return null
  }

  // Step 3: Semantic validation (skip for script strategy and level=none)
  if (strategyResult.strategy !== 'script' && level !== 'none') {
    const semanticResult = await validateExerciseSemantic(
      strategyResult.blocks,
      level,
      strategyResult.strategy,
      payload,
    )
    if (!semanticResult.ok) {
      await appendFailure(
        payload,
        duplicationId,
        exerciseRef,
        0,
        SEMANTIC_FAILURE_CODE,
        `Semantic mismatch: ${semanticResult.reasons.join('; ')}`,
      )
      return null
    }
  }

  return strategyResult
}

/**
 * Orchestrate the full duplication pipeline for a single LessonDuplications record.
 *
 * @param duplicationId  ID of the LessonDuplications record to process
 * @param payload        Payload instance
 *
 * Pre-condition: duplication record has status='pending'
 * Post-condition: duplication record has status='succeeded' (0 failures) or 'needs_review' (>0 failures)
 */
export async function runDuplicationOrchestrator(
  duplicationId: string,
  payload: Payload,
): Promise<void> {
  // Load the duplication record
  const duplication = await payload.findByID({
    collection: 'lesson-duplications',
    id: duplicationId,
    depth: 1, // need sourceLesson relationship
    overrideAccess: true,
  })

  if (!duplication) {
    logger.error({ duplicationId }, 'LessonDuplications record not found')
    return
  }

  if (duplication.status !== 'pending') {
    logger.warn(
      { duplicationId, status: duplication.status },
      'LessonDuplications record not in pending status, skipping',
    )
    return
  }

  // Set status=running
  await payload.update({
    collection: 'lesson-duplications',
    id: duplicationId,
    data: { status: 'running' },
    overrideAccess: true,
  })

  try {
    // K2: Get source exercises
    const sourceLessonId =
      typeof duplication.sourceLesson === 'string'
        ? duplication.sourceLesson
        : (duplication.sourceLesson as { id?: string })?.id

    if (!sourceLessonId) {
      throw new Error('sourceLesson relationship is missing or invalid')
    }

    const allExercises = await payload.find({
      collection: 'exercises',
      where: { lesson: { equals: sourceLessonId } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })

    const selectedExercises = selectExercisesScaled(allExercises.docs as ExerciseDoc[], 20)

    // Process all exercises with concurrency limit
    const results = await withConcurrencyLimit(selectedExercises, CONCURRENCY_LIMIT, (exercise) =>
      processExercise(
        exercise,
        duplicationId,
        duplication.level as 'none' | 'light' | 'medium' | 'deep',
        payload,
      ),
    )

    const succeeded = results.filter((r) => r !== null).length
    const failed = results.filter((r) => r === null).length

    logger.info(
      { duplicationId, total: selectedExercises.length, succeeded, failed },
      'Duplication orchestrator completed',
    )

    // Determine final status
    const finalStatus = failed === 0 ? 'succeeded' : 'needs_review'
    await payload.update({
      collection: 'lesson-duplications',
      id: duplicationId,
      data: { status: finalStatus },
      overrideAccess: true,
    })
  } catch (err) {
    logger.error({ duplicationId, err }, 'Orchestrator run failed')
    await payload.update({
      collection: 'lesson-duplications',
      id: duplicationId,
      data: { status: 'failed' },
      overrideAccess: true,
    })
    throw err
  }
}

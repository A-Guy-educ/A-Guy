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
import type { Exercise } from '@/payload-types'
import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'
import type { DuplicationSubject } from '@/server/payload/collections/LessonDuplications'
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
import { RouterStrategy } from '@/server/services/lesson-duplication/strategies/router'

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
 * K3: ScriptVariationStrategy for purely-algebraic exercises at light level.
 * K4: AiVariationStrategy for all other cases (throws until AI is wired up).
 *
 * @param exercise    Source exercise to vary
 * @param level       Duplication level (none/light/medium/deep)
 * @param _payload    Payload instance (available for future AI strategy use)
 * @returns           StrategyResult with generated blocks and strategy used
 */
export async function runStrategy(
  exercise: ExerciseDoc,
  level: 'none' | 'light' | 'medium' | 'deep',
  subject: DuplicationSubject,
  payload: Payload,
): Promise<StrategyResult> {
  const router = new RouterStrategy(payload)
  const result = await router.apply(exercise as unknown as Exercise, level, subject)

  const content = result.exercise.content as unknown as { blocks: ContentBlock[] }
  return {
    exerciseId: exercise.id,
    strategy: result.needsAiFallback ? 'ai' : 'script',
    blocks: content.blocks ?? [],
  }
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
    case 'INVALID_GEOMETRY_SPEC':
    case 'INVALID_AXIS_SPEC':
    case 'INVALID_GUIDED_EXPLANATION':
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

/** Mapping entry from source exercise to generated output exercise. */
interface OutputExerciseMapping {
  sourceExerciseId: string
  outputExerciseId: string
  strategy: DuplicationStrategy
}

/**
 * Create the output lesson (draft) by deep-copying every source-lesson field.
 *
 * Earlier versions only copied title/slug/status/chapter/course/tenant/locale,
 * which dropped fields like accessType, visibleRenderers, blocks, contentStatus,
 * and any custom flags the source lesson had. This caused variation outputs to
 * be thinner than what the `none` endpoint produces. We now mirror the
 * deep-clone behaviour of the `none` path so both routes produce equivalent
 * lessons modulo the title suffix and a forced `draft` status.
 */
async function createOutputLesson(
  payload: Payload,
  sourceLessonId: string,
  level: string,
): Promise<string> {
  const source = await payload.findByID({
    collection: 'lessons',
    id: sourceLessonId,
    depth: 0,
    overrideAccess: true,
  })
  const sourceData = source as unknown as Record<string, unknown>
  // Drop Payload-managed fields; the rest carries over.
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    ...rest
  } = sourceData as Record<string, unknown> & {
    id?: unknown
    createdAt?: unknown
    updatedAt?: unknown
  }
  void _id
  void _c
  void _u
  const base = (rest.title as string) ?? 'Lesson'
  const newLesson = await payload.create({
    collection: 'lessons',
    data: {
      ...rest,
      title: `${base} - Variation (${level})`,
      slug: undefined, // let the Lessons beforeChange hook regenerate a unique slug
      status: 'draft', // never publish a duplicate by default
    } as never,
    overrideAccess: true,
  })
  return newLesson.id
}

/**
 * Create a draft exercise in the output lesson with the generated blocks.
 * Returns the mapping entry for tracking.
 */
async function createOutputExercise(
  payload: Payload,
  result: StrategyResult,
  outputLessonId: string,
): Promise<OutputExerciseMapping> {
  const ex = await payload.create({
    collection: 'exercises',
    data: {
      title: `Variation of ${result.exerciseId}`,
      lesson: outputLessonId,
      content: { blocks: result.blocks },
      status: 'draft',
    } as never,
    overrideAccess: true,
  })
  return {
    sourceExerciseId: result.exerciseId,
    outputExerciseId: ex.id,
    strategy: result.strategy,
  }
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
  subject: DuplicationSubject,
  payload: Payload,
): Promise<StrategyResult | null> {
  const exerciseRef = exercise.id

  // Step 1: Run strategy
  let strategyResult: StrategyResult
  try {
    strategyResult = await runStrategy(exercise, level, subject, payload)
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

    // Create the output lesson before processing exercises
    const outputLessonId = await createOutputLesson(
      payload,
      sourceLessonId,
      duplication.level ?? 'light',
    )

    const allExercises = await payload.find({
      collection: 'exercises',
      where: { lesson: { equals: sourceLessonId } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })

    const selectedExercises = selectExercisesScaled(allExercises.docs as ExerciseDoc[], 20)

    const duplicationLevel = duplication.level as 'none' | 'light' | 'medium' | 'deep'
    const duplicationSubject =
      (duplication.subject as DuplicationSubject | null | undefined) ?? 'mixed'

    // Process all exercises with concurrency limit
    const results = await withConcurrencyLimit(
      selectedExercises,
      CONCURRENCY_LIMIT,
      async (exercise) => {
        const result = await processExercise(
          exercise,
          duplicationId,
          duplicationLevel,
          duplicationSubject,
          payload,
        )
        // If exercise succeeded, persist it to the DB
        if (result !== null) {
          const mapping = await createOutputExercise(payload, result, outputLessonId)
          return mapping
        }
        return null
      },
    )

    // Separate successful exercise mappings from null results (failures)
    const outputExerciseMappings: OutputExerciseMapping[] = results.filter(
      (r): r is OutputExerciseMapping => r !== null,
    )
    const failed = results.filter((r) => r === null).length
    const succeeded = outputExerciseMappings.length

    logger.info(
      { duplicationId, total: selectedExercises.length, succeeded, failed },
      'Duplication orchestrator completed',
    )

    // Determine final status
    const finalStatus = failed === 0 ? 'succeeded' : 'needs_review'
    await payload.update({
      collection: 'lesson-duplications',
      id: duplicationId,
      data: {
        status: finalStatus,
        outputLesson: outputLessonId,
        outputExercises: outputExerciseMappings,
      } as never,
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

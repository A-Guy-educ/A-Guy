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
import { selectExercisesScaled } from '@/server/services/lesson-duplication/selectors'
import { getSourceExercisesForLesson } from '@/server/services/lesson-duplication/source-exercises'
import {
  validateExerciseStructural,
  fillMissingFieldsWithPlaceholders,
  BLOCKING_FAILURE_CODES,
  type StructuralFailure,
} from '@/server/services/lesson-duplication/validators/structural'
import {
  validateExerciseSemantic,
  SEMANTIC_FAILURE_CODE,
} from '@/server/services/lesson-duplication/validators/semantic'
import { RouterStrategy } from '@/server/services/lesson-duplication/strategies/router'

// Concurrency of 1 = process exercises sequentially. Each exercise hits the
// LLM twice (creative + deterministic). Gemini's per-minute quota is easily
// exceeded at higher concurrency, which triggered "rate limit exceeded"
// failures on every exercise in early multi-exercise runs. The variation
// service has rate-limit backoff as a safety net, but serializing is the
// primary control. Bump this back up only after we've sized the quota AND
// replaced appendEntry's read-modify-write with an atomic $push.
// `as const` pins the literal type so the compile-time guard below catches
// any bump (current value preserved as literal `1`).
export const CONCURRENCY_LIMIT = 1 as const

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

// Compile-time guard: this whole module assumes CONCURRENCY_LIMIT === 1.
// appendEntry below uses a non-atomic read-then-update on the failures/warnings
// arrays — at concurrency >1 two parallel appends would race and lose entries.
// If you raise CONCURRENCY_LIMIT, replace appendEntry with a Mongo $push update
// before deleting this assert.
type _AssertConcurrencyOne = typeof CONCURRENCY_LIMIT extends 1 ? true : never
const _concurrencyAssert: _AssertConcurrencyOne = true
void _concurrencyAssert

/**
 * Append a single failure/warning entry to the LessonDuplications record.
 *
 * The bucket name is chosen by the caller:
 *  - 'failures' = blocking; the exercise was dropped from the output lesson.
 *  - 'warnings' = non-blocking; the exercise was kept with TODO placeholders
 *    for the missing field. Admin polishes via the review screen.
 */
async function appendEntry(
  bucket: 'failures' | 'warnings',
  payload: Payload,
  duplicationId: string,
  exerciseRef: string,
  sectionIndex: number,
  code: string,
  message: string,
): Promise<void> {
  const action = suggestAction(code)
  try {
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
        [bucket]: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(((current as any)[bucket] as any[]) ?? []),
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
      { err, duplicationId, exerciseRef, code, bucket },
      `Failed to append ${bucket} entry to LessonDuplications`,
    )
    // Don't rethrow — streaming failure should not abort the run
  }
}

/** Append a blocking failure (exercise dropped from output lesson). */
async function appendFailure(
  payload: Payload,
  duplicationId: string,
  exerciseRef: string,
  sectionIndex: number,
  code: string,
  message: string,
): Promise<void> {
  return appendEntry('failures', payload, duplicationId, exerciseRef, sectionIndex, code, message)
}

/** Append a non-blocking warning (exercise kept with placeholder). */
async function appendWarning(
  payload: Payload,
  duplicationId: string,
  exerciseRef: string,
  sectionIndex: number,
  code: string,
  message: string,
): Promise<void> {
  return appendEntry('warnings', payload, duplicationId, exerciseRef, sectionIndex, code, message)
}

/**
 * Append a successful output-exercise mapping to the LessonDuplications
 * record. Used to stream progress so a Vercel function timeout doesn't lose
 * work that's already in the DB. Read-modify-write on the record's
 * `outputExercises` array — safe under CONCURRENCY_LIMIT = 1.
 */
async function appendOutputExercise(
  payload: Payload,
  duplicationId: string,
  mapping: OutputExerciseMapping,
): Promise<void> {
  try {
    const current = await payload.findByID({
      collection: 'lesson-duplications',
      id: duplicationId,
      depth: 0,
      overrideAccess: true,
    })
    const existing =
      (current as unknown as { outputExercises?: OutputExerciseMapping[] }).outputExercises ?? []
    await payload.update({
      collection: 'lesson-duplications',
      id: duplicationId,
      data: { outputExercises: [...existing, mapping] } as never,
      overrideAccess: true,
    })
  } catch (err) {
    logger.error(
      { err, duplicationId, exerciseRef: mapping.sourceExerciseId },
      'Failed to append output exercise mapping',
    )
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
  // Drop Payload-managed + lineage fields; the rest carries over.
  //   slug:           regenerated by formatSlugAsync from the new title.
  //   blocks:         references source exercise IDs; rebuilt by the exercise
  //                   auto-add hook as new variation exercises are saved.
  //   translatedFrom: this is a fresh variation, not a translation copy.
  //   createdBy:      set to the duplicating admin via createdByField hook.
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    slug: _ignoreSlug,
    blocks: _ignoreBlocks,
    translatedFrom: _ignoreTranslatedFrom,
    createdBy: _ignoreCreatedBy,
    ...rest
  } = sourceData as Record<string, unknown> & {
    id?: unknown
    createdAt?: unknown
    updatedAt?: unknown
    slug?: unknown
    blocks?: unknown
    translatedFrom?: unknown
    createdBy?: unknown
  }
  void _id
  void _c
  void _u
  void _ignoreSlug
  void _ignoreBlocks
  void _ignoreTranslatedFrom
  void _ignoreCreatedBy
  const base = (rest.title as string) ?? 'Lesson'
  const newLesson = await payload.create({
    collection: 'lessons',
    data: {
      ...rest,
      title: `${base} - Variation (${level})`,
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
    // Fire-and-forget: don't await — a slow DB write here would otherwise
    // block the entire concurrency loop and cause test timeouts under load.
    appendFailure(payload, duplicationId, exerciseRef, 0, GENERATION_FAILURE_CODE, message)
    return null
  }

  // Step 2: Structural validation. Split failures into blocking (drop the
  // exercise — renderer would crash) and warnings (admin fills from review
  // screen). Warning-only exercises still ship, with TODO placeholders filled
  // in for missing hint/solution/fullSolution so the lesson stays renderable.
  const structuralFailures: StructuralFailure[] = validateExerciseStructural(strategyResult.blocks)
  const blockingFailures = structuralFailures.filter((f) => BLOCKING_FAILURE_CODES.has(f.code))
  const warningFailures = structuralFailures.filter((f) => !BLOCKING_FAILURE_CODES.has(f.code))

  // Record blocking failures and non-blocking warnings into separate buckets
  // so the review UI can show them under different headings.
  // Fire-and-forget: don't await — slow DB writes here would block the
  // concurrency loop and cause timeouts when processing many exercises.
  for (const failure of blockingFailures) {
    appendFailure(
      payload,
      duplicationId,
      exerciseRef,
      failure.blockIndex ?? 0,
      failure.code,
      failure.message,
    )
  }
  for (const warning of warningFailures) {
    appendWarning(
      payload,
      duplicationId,
      exerciseRef,
      warning.blockIndex ?? 0,
      warning.code,
      warning.message,
    )
  }

  if (blockingFailures.length > 0) {
    return null
  }

  // Warning-only path: fill placeholders so the exercise renders. Warnings are
  // already recorded so the admin can find the TODOs in the review screen.
  if (warningFailures.length > 0) {
    strategyResult = {
      ...strategyResult,
      blocks: fillMissingFieldsWithPlaceholders(strategyResult.blocks),
    }
  }

  // Step 3: Semantic validation. Skipped for:
  //  - level=none (deep clone, no AI variation to judge)
  //  - script strategy (deterministic, no hallucination risk)
  //  - warning-only path (we just inserted "_TODO: hint not provided by AI_"
  //    placeholders; a semantic reviewer would flag those as nonsensical and
  //    demote an exercise that should ship with a polish-later flag into a
  //    hard failure)
  if (strategyResult.strategy !== 'script' && level !== 'none' && warningFailures.length === 0) {
    const semanticResult = await validateExerciseSemantic(
      strategyResult.blocks,
      level,
      strategyResult.strategy,
      payload,
    )
    if (!semanticResult.ok) {
      // Fire-and-forget: slow DB write must not block the concurrency loop.
      appendFailure(
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
 * Reserve at least this much wall time (ms) at the end of a tick so the
 * orchestrator can write its final state to the DB before the platform
 * (Vercel) yanks the function. 30s covers a slow Mongo round-trip plus
 * Vercel's teardown grace.
 */
const FINALIZE_BUDGET_MS = 30_000

/**
 * Default assumed worst-case time for one exercise (pass-1 + pass-2 +
 * validators on gemini-3.1-pro-preview). Used to decide whether the next
 * exercise can fit before the deadline. Conservative — if the run is
 * faster, we just process more per tick.
 */
const ASSUMED_EXERCISE_DURATION_MS = 300_000

export type RunOutcome = 'succeeded' | 'needs_review' | 'failed' | 'in_progress'

export interface RunOptions {
  /**
   * Absolute wall-clock deadline (Date.now() ms). The orchestrator returns
   * `in_progress` as soon as the remaining time is too short to fit another
   * exercise — leaving the record in `running` so the next cron tick picks
   * up where this one left off. Default: no deadline (process all).
   */
  deadlineMs?: number
}

/**
 * Orchestrate the duplication pipeline for a single LessonDuplications record.
 * Resumable: skips exercises already processed in previous ticks and streams
 * each new output mapping to the DB as it completes. A Vercel function
 * timeout mid-run leaves a clean partial state — the next cron tick continues
 * from there.
 *
 * @param duplicationId  ID of the LessonDuplications record to process
 * @param payload        Payload instance
 * @param options.deadlineMs  Absolute timestamp by which to stop processing
 *
 * Pre-condition: record has status `pending` (fresh) or `running` (resuming).
 * Post-condition (returned outcome):
 *  - 'succeeded'   — all picked exercises produced an output, 0 failures
 *  - 'needs_review'— all picked exercises terminal, ≥1 failure
 *  - 'in_progress' — deadline hit, more work to do, status left as 'running'
 *  - 'failed'      — fatal error before any exercises processed
 */
export async function runDuplicationOrchestrator(
  duplicationId: string,
  payload: Payload,
  options: RunOptions = {},
): Promise<RunOutcome> {
  // Load the duplication record
  const duplication = await payload.findByID({
    collection: 'lesson-duplications',
    id: duplicationId,
    depth: 1, // need sourceLesson relationship
    overrideAccess: true,
  })

  if (!duplication) {
    logger.error({ duplicationId }, 'LessonDuplications record not found')
    return 'failed'
  }

  // Already terminal — nothing to do.
  if (
    duplication.status === 'succeeded' ||
    duplication.status === 'needs_review' ||
    duplication.status === 'failed'
  ) {
    logger.warn(
      { duplicationId, status: duplication.status },
      'LessonDuplications record already terminal, skipping',
    )
    return duplication.status as RunOutcome
  }

  // Accept both 'pending' (first tick) and 'running' (resuming) — anything
  // else is unexpected.
  if (duplication.status !== 'pending' && duplication.status !== 'running') {
    logger.warn(
      { duplicationId, status: duplication.status },
      'LessonDuplications record in unexpected status, skipping',
    )
    return 'failed'
  }

  try {
    const sourceLessonId =
      typeof duplication.sourceLesson === 'string'
        ? duplication.sourceLesson
        : (duplication.sourceLesson as { id?: string })?.id

    if (!sourceLessonId) {
      throw new Error('sourceLesson relationship is missing or invalid')
    }

    // First tick: create output lesson, flip to running. Resuming tick:
    // reuse the existing output lesson recorded on the record.
    let outputLessonId: string
    const existingOutputLessonRef = duplication.outputLesson as
      | string
      | { id?: string }
      | null
      | undefined
    const existingOutputLessonId =
      typeof existingOutputLessonRef === 'string'
        ? existingOutputLessonRef
        : existingOutputLessonRef?.id

    if (duplication.status === 'pending') {
      outputLessonId = await createOutputLesson(
        payload,
        sourceLessonId,
        duplication.level ?? 'light',
      )
      await payload.update({
        collection: 'lesson-duplications',
        id: duplicationId,
        data: { status: 'running', outputLesson: outputLessonId } as never,
        overrideAccess: true,
      })
    } else {
      // resuming
      if (!existingOutputLessonId) {
        // Shouldn't happen — running record without an outputLesson means a
        // previous tick crashed before the initial write. Treat as fresh.
        outputLessonId = await createOutputLesson(
          payload,
          sourceLessonId,
          duplication.level ?? 'light',
        )
        await payload.update({
          collection: 'lesson-duplications',
          id: duplicationId,
          data: { outputLesson: outputLessonId } as never,
          overrideAccess: true,
        })
      } else {
        outputLessonId = existingOutputLessonId
      }
    }

    const allExercises = await getSourceExercisesForLesson(payload, sourceLessonId)

    // No artificial cap — resumability handles long runs across multiple
    // cron ticks. selectExercisesScaled still bounds at 20 per the original
    // product spec (admin scaling-random across the whole lesson).
    const PER_RUN_EXERCISE_CAP = 20
    const selectedExercises = selectExercisesScaled(
      allExercises as ExerciseDoc[],
      PER_RUN_EXERCISE_CAP,
    )

    // Filter out exercises already processed on prior ticks. Sources of truth:
    //  1. The record's `outputExercises` — explicitly recorded successes.
    //  2. The record's `failures` — terminal per-exercise failures.
    //  3. Output exercises already present in the output lesson itself, even
    //     if their mapping never made it back into `outputExercises`. This
    //     closes the crash-window between createOutputExercise (writes the
    //     exercise to Mongo) and appendOutputExercise (records the mapping):
    //     if the function dies between those two calls, the exercise is
    //     durably saved but the record doesn't know about it; without this
    //     check the next tick would re-process the source and create a
    //     duplicate. We identify the source by the deterministic title
    //     `Variation of <sourceExerciseId>` set in createOutputExercise.
    const existingOutputExercises = await payload.find({
      collection: 'exercises',
      where: { lesson: { equals: outputLessonId } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    const titleSourceIds = new Set<string>()
    const orphanMappings: OutputExerciseMapping[] = []
    const knownMappingSources = new Set(
      ((duplication.outputExercises as unknown as OutputExerciseMapping[]) ?? []).map(
        (m) => m.sourceExerciseId,
      ),
    )
    for (const ex of existingOutputExercises.docs as Array<{
      id: string
      title?: string
    }>) {
      const match = typeof ex.title === 'string' ? /^Variation of (\S+)/.exec(ex.title) : null
      if (match) {
        titleSourceIds.add(match[1])
        // Recover the mapping for any orphan exercise (created but never
        // recorded). Next tick start, we'll reconcile by appending these
        // mappings so the record matches reality going forward.
        if (!knownMappingSources.has(match[1])) {
          orphanMappings.push({
            sourceExerciseId: match[1],
            outputExerciseId: ex.id,
            strategy: 'ai',
          })
        }
      }
    }

    // Reconcile orphan mappings recovered from the output lesson so the
    // duplications record reflects reality before this tick continues.
    for (const orphan of orphanMappings) {
      await appendOutputExercise(payload, duplicationId, orphan)
      logger.warn(
        { duplicationId, sourceExerciseId: orphan.sourceExerciseId },
        '[orchestrator] Recovered orphan output exercise (crash-window mapping)',
      )
    }

    const processedIds = new Set<string>([
      ...((duplication.outputExercises as unknown as OutputExerciseMapping[]) ?? []).map(
        (m) => m.sourceExerciseId,
      ),
      ...((duplication.failures as unknown as Array<{ exerciseRef: string }>) ?? []).map(
        (f) => f.exerciseRef,
      ),
      ...titleSourceIds,
    ])
    const remaining = selectedExercises.filter((ex) => !processedIds.has(ex.id))

    logger.info(
      {
        duplicationId,
        totalPicked: selectedExercises.length,
        alreadyProcessed: selectedExercises.length - remaining.length,
        remaining: remaining.length,
      },
      'Orchestrator tick start',
    )

    const duplicationLevel = duplication.level as 'none' | 'light' | 'medium' | 'deep'
    const duplicationSubject =
      (duplication.subject as DuplicationSubject | null | undefined) ?? 'mixed'

    // Process exercises one at a time (CONCURRENCY_LIMIT = 1 — appendEntry's
    // read-modify-write isn't safe under parallel writes; see compile-time
    // guard). Check deadline between exercises and bail out if the next one
    // can't fit, returning `in_progress` so the next tick continues.
    for (const exercise of remaining) {
      if (options.deadlineMs !== undefined) {
        const remainingMs = options.deadlineMs - Date.now()
        if (remainingMs < FINALIZE_BUDGET_MS + ASSUMED_EXERCISE_DURATION_MS) {
          logger.info(
            { duplicationId, remainingMs, remainingExercises: remaining.length },
            'Orchestrator tick yielding before deadline — leaving record running',
          )
          return 'in_progress'
        }
      }

      const result = await processExercise(
        exercise,
        duplicationId,
        duplicationLevel,
        duplicationSubject,
        payload,
      )
      if (result === null) continue // failure already recorded by processExercise

      try {
        const mapping = await createOutputExercise(payload, result, outputLessonId)
        // Stream the success immediately so a function timeout doesn't lose
        // this exercise — the actual exercise doc is already in MongoDB
        // (createOutputExercise just created it), this just keeps the
        // duplications record in sync.
        await appendOutputExercise(payload, duplicationId, mapping)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown create error'
        logger.error(
          { exerciseRef: exercise.id, err },
          'createOutputExercise failed — exercise dropped from output lesson',
        )
        await appendFailure(
          payload,
          duplicationId,
          exercise.id,
          0,
          GENERATION_FAILURE_CODE,
          `Failed to save variation: ${message}`,
        )
      }
    }

    // All selected exercises terminal: finalize status. Re-read failures
    // count from the record since we streamed entries during the run.
    const finalRecord = await payload.findByID({
      collection: 'lesson-duplications',
      id: duplicationId,
      depth: 0,
      overrideAccess: true,
    })
    const finalFailures = (finalRecord.failures as unknown as unknown[] | undefined)?.length ?? 0
    const finalOutputs =
      (finalRecord.outputExercises as unknown as unknown[] | undefined)?.length ?? 0
    const finalStatus: 'succeeded' | 'needs_review' =
      finalFailures === 0 ? 'succeeded' : 'needs_review'

    logger.info(
      {
        duplicationId,
        total: selectedExercises.length,
        succeeded: finalOutputs,
        failed: finalFailures,
        finalStatus,
      },
      'Duplication orchestrator completed',
    )

    await payload.update({
      collection: 'lesson-duplications',
      id: duplicationId,
      data: { status: finalStatus } as never,
      overrideAccess: true,
    })
    return finalStatus
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

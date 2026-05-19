/**
 * Per-exercise retry for lesson duplication review.
 *
 * POST /api/lesson-duplications/:id/retry-exercise
 * Body: { sourceExerciseId: string }
 *
 * Runs the full duplication pipeline (strategy → structural → semantic validation)
 * for a single source exercise. On success: clears the prior failure entries for this
 * source exercise and appends the new outputExercise mapping. On failure: clears
 * the prior failure entries and records the new ones.
 *
 * Access: admin only. maxDuration = 800s (same as process-now).
 */
import { withApiHandler } from '@/server/api/with-api-handler'
import { apiSuccess, ApiErrors } from '@/server/api/responses'
import { z } from 'zod'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import {
  createOutputExercise,
  runStrategy,
  trimSourceBlocksIfNeeded,
  appendFailure,
  appendWarning,
  type ExerciseDoc,
  type OutputExerciseMapping,
  type StrategyResult,
} from '@/server/services/lesson-duplication/orchestrator'
import {
  validateExerciseStructural,
  fillMissingFieldsWithPlaceholders,
  BLOCKING_FAILURE_CODES,
} from '@/server/services/lesson-duplication/validators/structural'
import {
  validateExerciseSemantic,
  SEMANTIC_FAILURE_CODE,
} from '@/server/services/lesson-duplication/validators/semantic'
import type { DuplicationSubject } from '@/server/payload/collections/LessonDuplications'
import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'
import type { Payload } from 'payload'

export const maxDuration = 800

const RetryBodySchema = z.object({
  sourceExerciseId: z.string().min(1),
})
type RetryBody = z.infer<typeof RetryBodySchema>

/**
 * Inline per-exercise duplication pipeline.
 * Mirrors the logic of processExercise but calls appendFailure/appendWarning
 * directly so failures are streamed to the DB during execution.
 */
async function processExerciseInline(
  exercise: ExerciseDoc,
  duplicationId: string,
  level: 'none' | 'light' | 'medium' | 'deep',
  subject: DuplicationSubject,
  payload: Payload,
): Promise<{ result: StrategyResult | null }> {
  const exerciseRef = exercise.id

  const trimmedExercise = trimSourceBlocksIfNeeded(exercise)

  // Step 1: Run strategy
  let strategyResult: StrategyResult
  try {
    const strategyResponse = await runStrategy(trimmedExercise, level, subject, payload)
    strategyResult = strategyResponse
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown strategy error'
    await appendFailure(payload, duplicationId, exerciseRef, 0, 'GENERATION_FAILED', message)
    return { result: null }
  }

  // Step 2: Structural validation
  const sourceBlocks = (trimmedExercise.content?.blocks ?? []) as ContentBlock[]
  const structuralFailures = validateExerciseStructural(strategyResult.blocks, sourceBlocks)
  const blockingFailures = structuralFailures.filter((f) => BLOCKING_FAILURE_CODES.has(f.code))
  const warningFailures = structuralFailures.filter((f) => !BLOCKING_FAILURE_CODES.has(f.code))

  for (const failure of blockingFailures) {
    await appendFailure(
      payload,
      duplicationId,
      exerciseRef,
      failure.blockIndex ?? 0,
      failure.code,
      failure.message,
    )
  }
  for (const warning of warningFailures) {
    await appendWarning(
      payload,
      duplicationId,
      exerciseRef,
      warning.blockIndex ?? 0,
      warning.code,
      warning.message,
    )
  }

  if (blockingFailures.length > 0) {
    return { result: null }
  }

  // Warning-only path: fill placeholders so the exercise renders
  if (warningFailures.length > 0) {
    strategyResult = {
      ...strategyResult,
      blocks: fillMissingFieldsWithPlaceholders(strategyResult.blocks),
    }
  }

  // Step 3: Semantic validation
  if (strategyResult.strategy !== 'script' && level !== 'none' && warningFailures.length === 0) {
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
      return { result: null }
    }
  }

  return { result: strategyResult }
}

export const POST = withApiHandler<RetryBody, unknown>(
  { auth: 'admin', bodySchema: RetryBodySchema },
  async ({ body, request }) => {
    const payload = await getPayload({ config: configPromise })

    // Extract duplicationId from URL: /api/lesson-duplications/:id/retry-exercise
    const url = new URL(request.url || 'http://localhost')
    const match = url.pathname.match(/\/lesson-duplications\/([^/]+)\/retry-exercise/)
    const duplicationId = match?.[1]
    if (!duplicationId) return ApiErrors.notFound('duplication id')

    // 1. Fetch duplication record
    const record = await payload.findByID({
      collection: 'lesson-duplications',
      id: duplicationId,
      depth: 1,
      overrideAccess: true,
    })
    if (!record) return ApiErrors.notFound('LessonDuplications record')

    // 2. Fetch source exercise
    let source
    try {
      source = await payload.findByID({
        collection: 'exercises',
        id: body.sourceExerciseId,
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      return ApiErrors.notFound(`Source exercise ${body.sourceExerciseId}`)
    }
    if (!source) return ApiErrors.notFound(`Source exercise ${body.sourceExerciseId}`)

    // 3. Get output lesson ID
    const outputLessonId =
      typeof record.outputLesson === 'string'
        ? record.outputLesson
        : (record.outputLesson as { id?: string })?.id
    if (!outputLessonId) return ApiErrors.conflict('No output lesson on this record')

    // 4. Collect old failure indices for this source exercise
    const oldFailures = [
      ...(((record.failures as unknown[]) ?? []) as Array<{ exerciseRef: string }>),
    ]
    const oldFailureIndicesToRemove = new Set<number>()
    for (let i = 0; i < oldFailures.length; i++) {
      if (oldFailures[i].exerciseRef === body.sourceExerciseId) {
        oldFailureIndicesToRemove.add(i)
      }
    }

    // 5. Collect old output exercise mapping for this source
    const oldOutputExercises = [
      ...(((record.outputExercises as unknown[]) ?? []) as OutputExerciseMapping[]),
    ]
    const oldMappingIdx = oldOutputExercises.findIndex(
      (m) => m.sourceExerciseId === body.sourceExerciseId,
    )

    // 6. Run the full single-exercise pipeline (inline, appends failures directly to DB)
    const level = (record.level ?? 'light') as 'none' | 'light' | 'medium' | 'deep'
    const subject = (record.subject as DuplicationSubject | null | undefined) ?? 'mixed'

    const { result } = await processExerciseInline(
      source as ExerciseDoc,
      duplicationId,
      level,
      subject,
      payload,
    )

    // 7. Compute updated failures array (clear old, keep others)
    // Note: new failures were already written to DB by processExerciseInline
    const updatedFailures = oldFailures.filter((_, i) => !oldFailureIndicesToRemove.has(i))

    // 8. Compute updated output exercises array
    let updatedOutputExercises = oldOutputExercises.filter((_, i) => i !== oldMappingIdx)

    if (result !== null) {
      // Success — create new output exercise and append mapping
      const newMapping = await createOutputExercise(payload, result, outputLessonId)
      updatedOutputExercises.push(newMapping)
    }

    // 9. Write all changes in one update
    await payload.update({
      collection: 'lesson-duplications',
      id: duplicationId,
      data: {
        failures: updatedFailures as never,
        outputExercises: updatedOutputExercises as never,
      } as never,
      overrideAccess: true,
    })

    return apiSuccess({
      duplicationId,
      success: result !== null,
      newFailures: [],
    })
  },
)

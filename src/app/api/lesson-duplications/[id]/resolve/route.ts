/**
 * Lesson Duplication Resolve API
 *
 * POST /api/lesson-duplications/:id/resolve
 *
 * Accepts an array of resolution actions for a LessonDuplications record in
 * needs_review status. Applies each action (skip / regenerate / keep) and
 * auto-finalizes the record to succeeded when all failures are resolved.
 *
 * Access: admin only.
 */
import { withApiHandler } from '@/server/api/with-api-handler'
import { apiSuccess, ApiErrors } from '@/server/api/responses'
import { z } from 'zod'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type {
  DuplicationLevel,
  DuplicationSubject,
} from '@/server/payload/collections/LessonDuplications'
import { validateExerciseStructural } from '@/server/services/lesson-duplication/validators/structural'
import { validateExerciseSemantic } from '@/server/services/lesson-duplication/validators/semantic'
import { generateVariation } from '@/infra/llm/services/lesson-duplication-variation-service'
import type { Exercise } from '@/payload-types'
import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'
import { VariationGenerationError } from '@/infra/llm/errors'

const ResolveBodySchema = z.object({
  actions: z
    .array(
      z.object({
        failureIndex: z.number().int().min(0),
        action: z.enum(['skip', 'regenerate', 'keep', 'looks_right']),
        level: z.enum(['light', 'medium', 'deep']).optional(),
      }),
    )
    .default([]),
})
type ResolveBody = z.infer<typeof ResolveBodySchema>

interface FailureEntry {
  exerciseRef: string
  sectionIndex: number
  code: string
  message: string
  suggestedAction: string
  resolved: boolean
}

interface OutputExerciseEntry {
  sourceExerciseId: string
  outputExerciseId: string
  strategy: string
}

export const POST = withApiHandler<ResolveBody, unknown>(
  { auth: 'admin', bodySchema: ResolveBodySchema },
  async ({ body, request }) => {
    const payload = await getPayload({ config: configPromise })

    // Extract id from route: /api/lesson-duplications/:id/resolve
    const url = new URL(request.url || 'http://localhost')
    const match = url.pathname.match(/\/lesson-duplications\/([^/]+)\/resolve/)
    const duplicationId = match?.[1]
    if (!duplicationId) {
      return ApiErrors.notFound('duplication id')
    }

    // Fetch record with depth=1 to resolve outputLesson + outputExercises + failures
    const record = await payload.findByID({
      collection: 'lesson-duplications',
      id: duplicationId,
      depth: 1,
      overrideAccess: true,
    })
    if (!record) return ApiErrors.notFound('LessonDuplications record')
    if (record.status !== 'needs_review') {
      return ApiErrors.internal('Can only resolve records in needs_review status')
    }

    const failures = [...((record.failures as unknown[]) ?? [])] as FailureEntry[]
    const outputExercises = [
      ...((record.outputExercises as unknown[]) ?? []),
    ] as OutputExerciseEntry[]
    // Reserved for future use — output lesson ID is available if needed
    const _outputLessonId =
      typeof record.outputLesson === 'string'
        ? record.outputLesson
        : (record.outputLesson as { id?: string })?.id
    void _outputLessonId

    for (const { failureIndex, action, level } of body.actions) {
      if (failureIndex < 0 || failureIndex >= failures.length) continue
      const failure = failures[failureIndex]
      if (failure.resolved) continue // skip already-resolved

      if (action === 'skip') {
        // Find output exercise for this failure's exerciseRef
        const mapping = outputExercises.find((m) => m.sourceExerciseId === failure.exerciseRef)
        if (mapping) {
          await payload.delete({
            collection: 'exercises',
            id: mapping.outputExerciseId,
            overrideAccess: true,
          })
          // Remove from outputExercises tracking
          const idx = outputExercises.indexOf(mapping)
          outputExercises.splice(idx, 1)
        }
        failure.resolved = true
      } else if (action === 'regenerate') {
        // Fetch source exercise
        const source = await payload.findByID({
          collection: 'exercises',
          id: failure.exerciseRef,
          depth: 0,
          overrideAccess: true,
        })
        if (!source) {
          return ApiErrors.internal(`Source exercise ${failure.exerciseRef} not found`)
        }
        const resolvedLevel = (level ?? record.level) as Exclude<DuplicationLevel, 'none'>
        const resolvedSubject = (record.subject as DuplicationSubject | null | undefined) ?? 'mixed'
        let blocks: ContentBlock[]
        try {
          const variation = await generateVariation(
            { exercise: source as Exercise, level: resolvedLevel, subject: resolvedSubject },
            payload,
          )
          blocks = (variation.exercise.content as { blocks: ContentBlock[] }).blocks
        } catch (err) {
          if (err instanceof VariationGenerationError) {
            return ApiErrors.internal(`Variation generation failed: ${err.reason}`)
          }
          return ApiErrors.internal(
            err instanceof Error ? err.message : 'Variation generation failed',
          )
        }
        // Structural validation
        const structFailures = validateExerciseStructural(blocks)
        if (structFailures.length > 0) {
          return ApiErrors.internal(
            `Regenerated exercise failed structural validation: ${structFailures[0].message}`,
          )
        }
        // Semantic validation (skip for script strategy)
        const mapping = outputExercises.find((m) => m.sourceExerciseId === failure.exerciseRef)
        const isAi = mapping?.strategy === 'ai'
        if (isAi) {
          const semResult = await validateExerciseSemantic(blocks, resolvedLevel, 'ai', payload)
          if (!semResult.ok) {
            return ApiErrors.internal(
              `Regenerated exercise failed semantic validation: ${semResult.reasons.join('; ')}`,
            )
          }
        }
        // Update output exercise
        if (mapping) {
          await payload.update({
            collection: 'exercises',
            id: mapping.outputExerciseId,
            data: { content: { blocks } } as never,
            overrideAccess: true,
          })
        }
        failure.resolved = true
      } else if (action === 'keep') {
        failure.resolved = true
      } else if (action === 'looks_right') {
        // looks_right marks the failure as resolved without modifying exercise content
        failure.resolved = true
      }
    }

    // Write updated failures + outputExercises back to record
    const allResolved = failures.every((f) => f.resolved)
    await payload.update({
      collection: 'lesson-duplications',
      id: duplicationId,
      data: {
        failures: failures as never,
        outputExercises: outputExercises as never,
        status: allResolved ? 'succeeded' : 'needs_review',
      } as never,
      overrideAccess: true,
    })

    return apiSuccess({ duplicationId, status: allResolved ? 'succeeded' : 'needs_review' })
  },
)

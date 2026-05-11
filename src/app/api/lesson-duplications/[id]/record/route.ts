/**
 * Lesson Duplication Record API
 *
 * GET /api/lesson-duplications/:id/record
 *
 * Returns the full LessonDuplications document with resolved relationships.
 * Also embeds source and output exercise content for the diff preview.
 * Used by the LessonDuplicationReview admin component.
 *
 * Access: admin only.
 */
import { withApiHandler } from '@/server/api/with-api-handler'
import { apiSuccess, ApiErrors } from '@/server/api/responses'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

interface OutputExerciseEntry {
  sourceExerciseId: string
  outputExerciseId: string
  strategy: string
}

interface EmbeddedExercise {
  id: string
  content?: { blocks: unknown[] }
}

interface ExercisePair {
  sourceExerciseId: string
  outputExerciseId: string
  strategy: string
  sourceContent: { blocks: unknown[] }
  outputContent: { blocks: unknown[] }
}

interface ExtendedRecord {
  id: string
  sourceLesson?: { id: string; title?: string } | string
  outputLesson?: { id: string } | string | null
  level: string
  status: string
  outputExercises: OutputExerciseEntry[]
  failures: unknown[]
  // Embedded exercise pairs for diff preview
  exercisePairs: ExercisePair[]
}

export const GET = withApiHandler<unknown, unknown>({ auth: 'admin' }, async ({ request }) => {
  const payload = await getPayload({ config: configPromise })

  // Extract id from route: /api/lesson-duplications/:id/record
  const url = new URL(request.url || 'http://localhost')
  const match = url.pathname.match(/\/lesson-duplications\/([^/]+)\/record/)
  const duplicationId = match?.[1]
  if (!duplicationId) {
    return ApiErrors.notFound('duplication id')
  }

  const record = await payload.findByID({
    collection: 'lesson-duplications',
    id: duplicationId,
    depth: 2, // resolve sourceLesson, outputLesson
    overrideAccess: false,
  })
  if (!record) return ApiErrors.notFound('LessonDuplications record')

  const outputExercises = [
    ...((record.outputExercises as unknown[]) ?? []),
  ] as OutputExerciseEntry[]

  // Batch-fetch all exercises referenced in outputExercises
  const allExerciseIds = new Set<string>()
  for (const entry of outputExercises) {
    allExerciseIds.add(entry.sourceExerciseId)
    allExerciseIds.add(entry.outputExerciseId)
  }

  // Fetch all exercises in parallel
  const exerciseFetches = Array.from(allExerciseIds).map((id) =>
    payload
      .findByID({
        collection: 'exercises',
        id,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null),
  )

  const exerciseResults = await Promise.all(exerciseFetches)
  const exerciseMap = new Map<string, EmbeddedExercise | null>()
  for (let i = 0; i < Array.from(allExerciseIds).length; i++) {
    exerciseMap.set(Array.from(allExerciseIds)[i], exerciseResults[i] as EmbeddedExercise | null)
  }

  // Build exercise pairs with embedded content
  const exercisePairs: ExercisePair[] = outputExercises.map((entry) => {
    const source = exerciseMap.get(entry.sourceExerciseId)
    const output = exerciseMap.get(entry.outputExerciseId)
    return {
      sourceExerciseId: entry.sourceExerciseId,
      outputExerciseId: entry.outputExerciseId,
      strategy: entry.strategy,
      sourceContent: source?.content ?? { blocks: [] },
      outputContent: output?.content ?? { blocks: [] },
    }
  })

  const extendedRecord: ExtendedRecord = {
    id: record.id as string,
    sourceLesson: record.sourceLesson as ExtendedRecord['sourceLesson'],
    outputLesson: record.outputLesson as ExtendedRecord['outputLesson'],
    level: record.level as string,
    status: record.status as string,
    outputExercises,
    failures: record.failures as unknown[],
    exercisePairs,
  }

  return apiSuccess(extendedRecord)
})

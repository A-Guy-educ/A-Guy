/**
 * Resolve the exercises that belong to a source lesson for duplication.
 *
 * Lesson ↔ exercise links are bidirectional but not always consistent:
 *  - `lesson.blocks` is a serialized array of block references; for
 *    exercise-bearing blocks, each entry has `{ blockType: 'exerciseRef',
 *    exercise: <id> }`. This is the authoritative content of the lesson
 *    (and matches the renderer's read path).
 *  - `exercise.lesson` is a foreign key set when the exercise was first
 *    created under a lesson. It can diverge from `lesson.blocks` when an
 *    exercise is referenced from a different lesson via blocks.
 *
 * Earlier versions queried `exercises.where: { lesson: equals: id }` only,
 * which returned 0 for lessons that reference exercises owned by another
 * lesson — silently producing empty variations. We now prefer
 * `lesson.blocks` and fall back to the FK reverse query when blocks is
 * missing or doesn't list any exercise refs.
 */
import type { Payload } from 'payload'
import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'
import { logger } from '@/infra/utils/logger'

export type ExerciseDoc = {
  id: string
  content?: { blocks?: ContentBlock[] }
  // Other fields exist on the real exercise document but are not used by the
  // duplication pipeline; left untyped to keep this helper decoupled from the
  // generated Payload type.
}

/**
 * Extract exercise IDs from a lesson's `blocks` field.
 *
 * `blocks` may be stored as a JSON string (legacy serialization) or a parsed
 * array. We tolerate both. Non-exercise blocks (rich_text, latex, …) are
 * skipped; we only return ids for blocks of type `exerciseRef`.
 *
 * Order is preserved so the orchestrator's bucket-based selector picks
 * exercises that span the lesson uniformly.
 */
export function extractExerciseIdsFromLessonBlocks(blocksField: unknown): string[] {
  let blocks: unknown = blocksField
  if (typeof blocks === 'string') {
    try {
      blocks = JSON.parse(blocks)
    } catch {
      return []
    }
  }
  if (!Array.isArray(blocks)) return []
  const ids: string[] = []
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    const b = block as Record<string, unknown>
    if (b.blockType !== 'exerciseRef') continue
    const ref = b.exercise
    if (typeof ref === 'string' && ref.length > 0) {
      ids.push(ref)
    } else if (ref && typeof ref === 'object' && typeof (ref as { id?: unknown }).id === 'string') {
      ids.push((ref as { id: string }).id)
    }
  }
  return ids
}

/**
 * Get the exercises that belong to a lesson, in lesson-blocks order.
 *
 * Strategy:
 *  1. Read `lesson.blocks` and resolve any `exerciseRef` ids.
 *  2. Batch-fetch each referenced exercise. Missing/deleted refs are skipped
 *     (logged at debug level so admins can spot dangling references).
 *  3. If `lesson.blocks` yielded nothing, fall back to a foreign-key reverse
 *     query for backwards compatibility with lessons that haven't been
 *     migrated to the blocks model.
 */
export async function getSourceExercisesForLesson(
  payload: Payload,
  lessonId: string,
): Promise<ExerciseDoc[]> {
  const lesson = await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 0,
    overrideAccess: true,
  })

  const referencedIds = extractExerciseIdsFromLessonBlocks(
    (lesson as unknown as { blocks?: unknown }).blocks,
  )

  if (referencedIds.length > 0) {
    const fetched = await Promise.all(
      referencedIds.map((id) =>
        payload
          .findByID({ collection: 'exercises', id, depth: 0, overrideAccess: true })
          .then((doc) => doc as unknown as ExerciseDoc)
          .catch((err) => {
            logger.warn(
              { lessonId, exerciseId: id, err: err instanceof Error ? err.message : err },
              '[duplication] referenced exercise not found — skipping',
            )
            return null
          }),
      ),
    )
    const present = fetched.filter((d): d is ExerciseDoc => d !== null)
    if (present.length > 0) return present
  }

  // Fallback: FK reverse query. Useful for legacy lessons / freshly-created
  // duplicates that haven't populated their blocks field yet.
  const fkQuery = await payload.find({
    collection: 'exercises',
    where: { lesson: { equals: lessonId } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return fkQuery.docs as unknown as ExerciseDoc[]
}

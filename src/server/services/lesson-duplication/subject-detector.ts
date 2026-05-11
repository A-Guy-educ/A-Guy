/**
 * Subject Auto-Detection from Lesson Block Content
 *
 * @fileType utility
 * @domain lesson-duplication
 * @pattern subject-detector
 * @ai-summary Scans the blocks of every exercise in a lesson to guess the lesson's subject (algebra/geometry/calculus/mixed).
 *
 * Rules:
 *   - Any `question_geometry` block → contributes "geometry".
 *   - Any `question_axis` or `question_multi_axis` block → contributes "calculus" (graph plots are typically
 *     used to teach functions/derivatives/integrals at this level of curriculum).
 *   - Both contribute → "mixed".
 *   - Neither contribute → "algebra" (the default for non-visual math exercises).
 *
 * Returns one of the canonical `DuplicationSubject` values from
 * `LessonDuplications`. Never returns null; the worst case is "algebra".
 */

import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'
import type { DuplicationSubject } from '@/server/payload/collections/LessonDuplications'

/** Shape we read from each exercise — just the blocks. */
export interface ExerciseLikeBlocks {
  content?: { blocks?: ContentBlock[] } | null
}

/** True for geometry-shaped blocks. */
function isGeometryBlock(block: ContentBlock): boolean {
  return block.type === 'question_geometry'
}

/** True for axis (single or multi) graph blocks. */
function isAxisBlock(block: ContentBlock): boolean {
  return block.type === 'question_axis' || block.type === 'question_multi_axis'
}

/**
 * Inspect a single exercise's blocks for geometry / axis signal.
 * Returns the two booleans separately so the caller can aggregate across exercises.
 */
function scanExerciseBlocks(exercise: ExerciseLikeBlocks): { geometry: boolean; axis: boolean } {
  const blocks = exercise.content?.blocks ?? []
  let geometry = false
  let axis = false
  for (const block of blocks) {
    if (!geometry && isGeometryBlock(block)) geometry = true
    if (!axis && isAxisBlock(block)) axis = true
    if (geometry && axis) break // early exit — exercise already mixed
  }
  return { geometry, axis }
}

/**
 * Detect the subject of a lesson by scanning the blocks of every exercise.
 *
 * @param exercises  All exercises that belong to the lesson being duplicated.
 *                   Each item just needs `content.blocks[]`.
 * @returns          The detected `DuplicationSubject`. Default is "algebra".
 */
export function detectLessonSubject(exercises: ExerciseLikeBlocks[]): DuplicationSubject {
  let anyGeometry = false
  let anyAxis = false

  for (const exercise of exercises) {
    const { geometry, axis } = scanExerciseBlocks(exercise)
    if (geometry) anyGeometry = true
    if (axis) anyAxis = true
    if (anyGeometry && anyAxis) break // early exit — lesson is already mixed
  }

  if (anyGeometry && anyAxis) return 'mixed'
  if (anyGeometry) return 'geometry'
  if (anyAxis) return 'calculus'
  return 'algebra'
}

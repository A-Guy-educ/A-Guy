/**
 * Idempotency key utilities for PDF→Exercises conversion
 *
 * Provides source-based identity keys for deterministic deduplication.
 * Format: {tenantId}:{lessonId}:{sourceDocId}:{pageStart}-{pageEnd}:{systemOrdinal}:{specVersion}
 *
 * Uses source position (page range + SYSTEM-DERIVED ORDINAL) rather than LLM-derived ordering
 * or content hashing to ensure same content on different pages produces different exercises.
 *
 * CRITICAL: The ordinal MUST be the array index from code execution (deterministic),
 * NOT the LLM-provided `orderInSegment` (non-deterministic across runs).
 */

/**
 * Current spec version - bump when extraction contract changes
 */
export const SPEC_VERSION = 'v1'

/**
 * Interface for computing idempotency key from exercise data
 */
export interface IdempotencyParams {
  tenantId: string
  lessonId: string
  sourceDocId: string
  pageStart: number
  pageEnd: number
  systemOrdinal: number
  specVersion?: string
}

/**
 * Enriched exercise type for deduplication operations
 * Note: orderInSegment is LLM-derived and stored for debugging only,
 * NOT used for idempotency key computation (see createIdempotencyKeyFn)
 */
export interface EnrichedExercise {
  title: string
  blocks: Array<{
    type: string
    id: string
    value?: string
    format?: string
    latex?: string
    renderMode?: string
  }>
  orderInSegment: number // LLM-provided, stored as metadata only
}

/**
 * Compute idempotency key for an exercise
 *
 * Format: {tenantId}:{lessonId}:{sourceDocId}:{pageStart}-{pageEnd}:{systemOrdinal}:{specVersion}
 *
 * Examples:
 * - t1:l1:d1:1-3:0:v1
 * - abc123:lesson456:doc789:1-3:0:v1
 *
 * @param params - Exercise source parameters (systemOrdinal is CODE-DERIVED, not LLM)
 * @returns Deterministic idempotency key string
 */
export function computeIdempotencyKey(params: IdempotencyParams): string {
  const {
    tenantId,
    lessonId,
    sourceDocId,
    pageStart,
    pageEnd,
    systemOrdinal,
    specVersion = SPEC_VERSION,
  } = params

  // Validate required parameters
  if (!tenantId || !lessonId || !sourceDocId) {
    throw new Error('tenantId, lessonId, and sourceDocId are required')
  }
  if (pageStart < 1 || pageEnd < pageStart || systemOrdinal < 0) {
    throw new Error('Invalid page range or system ordinal')
  }

  return `${tenantId}:${lessonId}:${sourceDocId}:${pageStart}-${pageEnd}:${systemOrdinal}:${specVersion}`
}

/**
 * Deduplicate exercises by idempotency key
 *
 * Keeps the last occurrence when duplicates are found (last-wins semantics).
 *
 * @param exercises - Array of exercises to deduplicate
 * @param keyFn - Function to extract idempotency key from exercise and system index
 * @returns Object containing deduplicated exercises and count of dropped items
 */
export function deduplicateByIdempotencyKey(
  exercises: EnrichedExercise[],
  keyFn: (ex: EnrichedExercise, systemIndex: number) => string,
): { exercises: EnrichedExercise[]; droppedCount: number } {
  if (exercises.length === 0) {
    return { exercises: [], droppedCount: 0 }
  }

  const seen = new Map<string, number>() // key -> last index
  const result: EnrichedExercise[] = []

  // First pass: record last index of each key
  for (let i = 0; i < exercises.length; i++) {
    const key = keyFn(exercises[i], i)
    seen.set(key, i)
  }

  // Second pass: keep only items at their last occurrence
  for (let i = 0; i < exercises.length; i++) {
    const key = keyFn(exercises[i], i)
    if (seen.get(key) === i) {
      result.push(exercises[i])
    }
  }

  return {
    exercises: result,
    droppedCount: exercises.length - result.length,
  }
}

/**
 * Create idempotency key function for a specific segment
 *
 * Returns a function that computes idempotency keys for exercises
 * within a given segment context. The systemOrdinal is derived from
 * the loop index (deterministic), NOT from LLM orderInSegment.
 *
 * @param segmentParams - Fixed segment parameters (tenantId, lessonId, sourceDocId, page range)
 * @returns Function that takes (exercise, systemIndex) and returns idempotency key
 *
 * Usage:
 * const computeKey = createIdempotencyKeyFn({ tenantId, lessonId, sourceDocId, pageStart, pageEnd })
 * for (let i = 0; i < exercises.length; i++) {
 *   const key = computeKey(exercises[i], i)  // i = system ordinal
 * }
 */
export function createIdempotencyKeyFn(segmentParams: {
  tenantId: string
  lessonId: string
  sourceDocId: string
  pageStart: number
  pageEnd: number
  specVersion?: string
}): (exercise: EnrichedExercise, systemIndex: number) => string {
  const { tenantId, lessonId, sourceDocId, pageStart, pageEnd, specVersion } = segmentParams

  return (exercise: EnrichedExercise, systemIndex: number) =>
    computeIdempotencyKey({
      tenantId,
      lessonId,
      sourceDocId,
      pageStart,
      pageEnd,
      systemOrdinal: systemIndex, // CODE-DERIVED from loop index, NOT LLM orderInSegment
      specVersion,
    })
}

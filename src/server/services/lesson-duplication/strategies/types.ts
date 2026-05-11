/**
 * Variation Strategy Types
 *
 * @fileType utility
 * @domain lesson-duplication
 * @pattern variation-strategy
 * @ai-summary Defines the VariationStrategy interface and VariationResult type used by the duplication router.
 */

import type { Exercise } from '@/payload-types'
import type {
  DuplicationLevel,
  DuplicationSubject,
} from '@/server/payload/collections/LessonDuplications'

/**
 * Return type for all variation strategies.
 * - exercise: the variation (or original for level=none)
 * - needsAiFallback: true when the script could not produce a safe variation
 *                    and the caller should fall through to the AI strategy.
 */
export interface VariationResult {
  exercise: Exercise
  needsAiFallback?: true
}

/**
 * Single contract for all variation generation strategies.
 * The orchestrator calls only this interface — concrete impls are private.
 */
export interface VariationStrategy {
  apply(
    exercise: Exercise,
    level: DuplicationLevel,
    subject?: DuplicationSubject,
  ): Promise<VariationResult>
}

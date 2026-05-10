/**
 * Lesson Duplication Router Strategy
 *
 * Routes each exercise to the appropriate variation generation strategy.
 * The orchestrator calls this per-exercise in a concurrency-limited loop.
 *
 * Current implementation delegates to the LLM-based variation service.
 * Future: For purely-algebraic exercises at light level, prefer script-strategy.
 */
import type { Payload } from 'payload'
import type { Exercise } from '@/payload-types'
import type { DuplicationLevel } from '@/server/payload/collections/LessonDuplications'

import { generateVariation } from '@/infra/llm/services/lesson-duplication-variation-service'

/**
 * Route an exercise to the appropriate variation strategy and return the variation.
 *
 * @param exercise - The source exercise to generate a variation for
 * @param level - The transformation level (none, light, medium, deep)
 * @param payload - Payload instance for LLM service calls
 * @returns The variation result (or original exercise for level=none)
 * @throws VariationGenerationError - When variation generation fails after retry
 */
export async function routeVariation(
  exercise: Exercise,
  level: DuplicationLevel,
  payload: Payload,
): Promise<{ exercise: Exercise }> {
  if (level === 'none') {
    // No variation requested — return exercise as-is
    return { exercise }
  }

  // TODO: For purely-algebraic exercises + light level, prefer script-strategy
  // before falling back to LLM:
  // if (level === 'light' && isPurelyAlgebraic(exercise)) {
  //   return generateScriptVariation(exercise)
  // }

  // Delegate to LLM-based variation service for light/medium/deep
  return generateVariation({ exercise, level }, payload)
}

/**
 * Lesson Duplication Router
 *
 * @fileType utility
 * @domain lesson-duplication
 * @pattern variation-router
 * @ai-summary Routes exercises to the appropriate variation strategy (script or AI).
 */

import type { Exercise } from '@/payload-types'
import type { DuplicationLevel } from '@/server/payload/collections/LessonDuplications'
import type { VariationStrategy, VariationResult } from './types'
import { ScriptVariationStrategy } from './script-strategy'

/** AI placeholder strategy — throws until K4 is implemented. */
class AiVariationStrategy implements VariationStrategy {
  async apply(exercise: Exercise, level: DuplicationLevel): Promise<VariationResult> {
    if (level === 'none') return { exercise }
    // K4: implement AI variation
    throw new Error('AiVariationStrategy is not yet implemented (K4)')
  }
}

/**
 * RouterStrategy — single entry point used by the orchestrator.
 *
 * Routing rules:
 *  - level=none: return exercise unchanged
 *  - light + purely-algebraic: ScriptVariationStrategy (fast, no AI)
 *  - light + not algebraic OR medium/deep: AiVariationStrategy (throws until K4)
 */
export class RouterStrategy implements VariationStrategy {
  private readonly scriptStrategy = new ScriptVariationStrategy()
  private readonly aiStrategy = new AiVariationStrategy()

  async apply(exercise: Exercise, level: DuplicationLevel): Promise<VariationResult> {
    if (level === 'none') {
      return { exercise }
    }

    // Try script strategy for light + purely-algebraic
    if (level === 'light') {
      const result = await this.scriptStrategy.apply(exercise, level)
      if (!result.needsAiFallback) {
        return result
      }
      // Fall through to AI if script returned needsAiFallback
    }

    // K4: medium/deep, or light with needsAiFallback → AI
    return this.aiStrategy.apply(exercise, level)
  }
}

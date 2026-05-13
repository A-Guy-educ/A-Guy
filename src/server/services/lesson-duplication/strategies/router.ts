/**
 * Lesson Duplication Router
 *
 * @fileType utility
 * @domain lesson-duplication
 * @pattern variation-router
 * @ai-summary Routes exercises to the appropriate variation strategy (script or AI).
 */

import type { Payload } from 'payload'
import type { Exercise } from '@/payload-types'
import type {
  DuplicationLevel,
  DuplicationSubject,
} from '@/server/payload/collections/LessonDuplications'
import type { VariationStrategy, VariationResult } from './types'
// Re-export so callers can inject mock implementations
export type { VariationStrategy, VariationResult } from './types'
import { ScriptVariationStrategy } from './script-strategy'

/** AI variation strategy — calls generateVariation with two-pass approach. */
class AiVariationStrategy implements VariationStrategy {
  constructor(private readonly payload: Payload) {
    this.payload = payload
  }

  async apply(
    exercise: Exercise,
    level: DuplicationLevel,
    subject?: DuplicationSubject,
  ): Promise<VariationResult> {
    void subject // subject parameter required by VariationStrategy interface
    if (level === 'none') return { exercise }

    const effectiveSubject: DuplicationSubject = subject ?? 'mixed'
    const { generateVariation } =
      await import('@/infra/llm/services/lesson-duplication-variation-service')
    const result = await generateVariation(
      {
        exercise,
        level: level as Exclude<DuplicationLevel, 'none'>,
        subject: effectiveSubject,
      },
      this.payload,
    )
    return { exercise: result.exercise }
  }
}

/**
 * RouterStrategy — single entry point used by the orchestrator.
 *
 * Routing rules:
 *  - level=none: return exercise unchanged
 *  - light + purely-algebraic: ScriptVariationStrategy (fast, no AI)
 *  - light + not algebraic OR medium/deep: AiVariationStrategy (two-pass)
 *
 * @param payload - Payload CMS instance
 * @param scriptStrategy - Script variation strategy (default: ScriptVariationStrategy)
 * @param aiStrategy - AI variation strategy override (default: AiVariationStrategy).
 *                      Pass a mock/stub for fast deterministic tests that bypass the LLM.
 */
export class RouterStrategy implements VariationStrategy {
  constructor(
    private readonly payload: Payload,
    private readonly scriptStrategy = new ScriptVariationStrategy(),
    private readonly aiStrategy: VariationStrategy = new AiVariationStrategy(payload),
  ) {}

  async apply(
    exercise: Exercise,
    level: DuplicationLevel,
    subject?: DuplicationSubject,
  ): Promise<VariationResult> {
    if (level === 'none') {
      return { exercise }
    }

    // Try script strategy for light + purely-algebraic
    if (level === 'light') {
      const result = await this.scriptStrategy.apply(exercise, level, subject)
      if (!result.needsAiFallback) {
        return result
      }
      // Fall through to AI if script returned needsAiFallback
    }

    // medium/deep, or light with needsAiFallback → AI
    return this.aiStrategy.apply(exercise, level, subject)
  }
}

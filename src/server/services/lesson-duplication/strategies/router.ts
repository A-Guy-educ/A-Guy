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
import { ScriptVariationStrategy } from './script-strategy'

/** AI variation strategy — calls generateVariation with two-pass approach. */
export class AiVariationStrategy implements VariationStrategy {
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
 */
export class RouterStrategy implements VariationStrategy {
  constructor(
    private readonly payload: Payload,
    private readonly scriptStrategy = new ScriptVariationStrategy(),
    private readonly aiStrategyFactory: (payload: Payload) => VariationStrategy = (p) =>
      new AiVariationStrategy(p),
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
    const aiStrategy = this.aiStrategyFactory(this.payload)
    return aiStrategy.apply(exercise, level, subject)
  }
}

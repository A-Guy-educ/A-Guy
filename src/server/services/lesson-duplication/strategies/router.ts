/**
 * Variation router — picks script strategy first, AI strategy second.
 *
 * @fileType utility
 * @domain lessons
 * @pattern strategy-router
 * @ai-summary Routes a (exercise, level) pair to the script strategy when eligible, otherwise to AI.
 *
 * The AI strategy isn't built yet (K4). For now the router falls back to a
 * placeholder that throws so the orchestrator can record a failure and move
 * on. Once K4 lands, swap the placeholder for the real AI strategy.
 */

import { ScriptVariationStrategy } from './script-strategy'
import type { ExerciseLike, VariationLevel, VariationResult, VariationStrategy } from './types'

/** Placeholder AI strategy — replaced in K4. Throws a typed error so the orchestrator can catch it. */
export class AiStrategyNotImplementedError extends Error {
  readonly code = 'AI_STRATEGY_NOT_IMPLEMENTED'
  constructor(reason: string) {
    super(`AI variation strategy not implemented: ${reason}`)
  }
}

class PlaceholderAiStrategy implements VariationStrategy {
  readonly name = 'ai-placeholder'
  async apply(): Promise<VariationResult> {
    throw new AiStrategyNotImplementedError('K4 not yet wired in')
  }
}

export interface RouterOptions {
  scriptStrategy?: VariationStrategy
  aiStrategy?: VariationStrategy
}

export class VariationRouter implements VariationStrategy {
  readonly name = 'router'
  private readonly script: VariationStrategy
  private readonly ai: VariationStrategy

  constructor(opts: RouterOptions = {}) {
    this.script = opts.scriptStrategy ?? new ScriptVariationStrategy()
    this.ai = opts.aiStrategy ?? new PlaceholderAiStrategy()
  }

  async apply(
    exercise: ExerciseLike,
    level: VariationLevel,
    seed?: number,
  ): Promise<VariationResult> {
    // Script is only useful for `light`. Skip straight to AI for medium/deep.
    if (level === 'light') {
      const scriptResult = await this.script.apply(exercise, level, seed)
      if (!scriptResult.needsAiFallback) return scriptResult
    }
    return this.ai.apply(exercise, level, seed)
  }
}

/**
 * Variation strategy types — shared by script and AI implementations.
 *
 * @fileType utility
 * @domain lessons
 * @pattern strategy
 * @ai-summary Shape and contract for per-exercise variation strategies (light/medium/deep).
 *
 * The orchestrator (K5) calls `strategy.apply(exercise, level)` for each
 * source exercise. Strategies must:
 *   - Never mutate `exercise`.
 *   - Return a new variation object of the same shape.
 *   - Set `needsAiFallback: true` when the strategy can't safely produce a
 *     correct answer (the orchestrator then routes the same exercise to the
 *     AI strategy from K4).
 */

export type VariationLevel = 'light' | 'medium' | 'deep'

/**
 * Minimal shape the variation strategies operate on. The DB Exercise type is
 * adapted to this by the orchestrator. Keeping it generic here avoids tying
 * the strategies to Payload types.
 *
 * Fields mirror the canonical export JSON used by the duplication feature:
 *   - `text`            top-level question/prompt
 *   - `svg`             SVG markup or empty string (PNG is forbidden)
 *   - `sections[]`      sub-questions, each with its own text/hint/solution
 *   - `correct_option`  the exercise-level correct answer (when applicable)
 *   - `wrong_options`   distractors for multiple-choice exercises
 *   - `hint`            top-level hint
 *   - `solution`        short final answer
 *   - `full_solution`   step-by-step explanation
 */
export interface ExerciseLike {
  text?: string
  svg?: string
  sections?: SectionLike[]
  hint?: string
  solution?: string
  full_solution?: string
  correct_option?: string | number
  wrong_options?: Array<string | number>
  table?: { headers?: unknown[]; rows_data?: unknown[][] } | null
}

export interface SectionLike {
  text?: string
  svg?: string
  hint?: string
  solution?: string
  full_solution?: string
  correct_option?: string | number
  wrong_options?: Array<string | number>
}

export interface VariationResult {
  exercise: ExerciseLike
  /** Set when the strategy declines responsibility — the caller should retry with AI. */
  needsAiFallback?: boolean
  /** Human-readable note explaining why fallback was chosen (for logs/failures). */
  fallbackReason?: string
}

export interface VariationStrategy {
  /** Strategy name for logs and failure entries. */
  readonly name: string
  /**
   * Produce a variation of the exercise at the given level, or signal that
   * the caller should fall back to AI.
   */
  apply(exercise: ExerciseLike, level: VariationLevel, seed?: number): Promise<VariationResult>
}

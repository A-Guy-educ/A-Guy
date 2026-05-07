/**
 * Script-based variation strategy for purely-algebraic exercises.
 *
 * @fileType utility
 * @domain lessons
 * @pattern strategy
 * @ai-summary Swaps numeric literals (±30%) and recomputes the answer when the exercise is one arithmetic expression.
 *
 * Only handles `level=light`. Anything else (medium/deep) returns
 * `needsAiFallback=true` so the orchestrator routes to the AI strategy.
 *
 * Recompute rules:
 *   - If the exercise is a single arithmetic expression we can evaluate
 *     deterministically (e.g. "5 + 3", "12 × 4 = ?"), the new answer is
 *     computed from the swapped numbers.
 *   - Anything more complex (multiple operators across multiple lines, mixed
 *     equations, fractions, multi-step) → needsAiFallback. We never invent
 *     answers we can't verify.
 */

import { isPurelyAlgebraic } from './algebraic-detector'
import type {
  ExerciseLike,
  SectionLike,
  VariationLevel,
  VariationResult,
  VariationStrategy,
} from './types'

/** Mulberry32 — seeded PRNG, identical pattern to selectors.ts for consistency. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Swap a single numeric literal for one within ±30%, preserving sign + integer/decimal shape. */
function swapNumber(raw: string, rng: () => number): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw

  const isInt = Number.isInteger(n)
  const sign = n < 0 ? -1 : 1
  const abs = Math.abs(n)
  // Keep zero as zero — perturbing creates ambiguity (negative? rounded to 1?).
  if (abs === 0) return raw

  // ±30% jitter, never landing on the original.
  const jitter = (rng() - 0.5) * 0.6 // [-0.3, 0.3)
  let candidate = abs * (1 + jitter)

  if (isInt) {
    candidate = Math.max(1, Math.round(candidate))
    if (candidate === abs) candidate = abs + 1
  } else {
    // preserve roughly the same number of decimal places
    const decimals = (raw.split('.')[1] ?? '').length || 1
    candidate = parseFloat(Math.max(0.01, candidate).toFixed(decimals))
    if (candidate === abs) candidate = parseFloat((abs + Math.pow(10, -decimals)).toFixed(decimals))
  }

  return String(sign * candidate)
}

/** Replace every numeric literal in `text` with a swapped value. */
function rewriteNumbersInText(text: string | undefined, rng: () => number): string | undefined {
  if (text === undefined) return undefined
  return text.replace(/-?\d+(?:\.\d+)?/g, (raw) => swapNumber(raw, rng))
}

/**
 * Try to evaluate `text` as a single safe arithmetic expression.
 * Returns the numeric result, or `null` if anything looks non-trivial.
 *
 * "Safe" = only digits, decimal points, +, -, *, /, ×, ÷, parentheses, whitespace.
 * Anything else (variables, equations, multiple statements) → null.
 */
function tryEvalArithmetic(text: string): number | null {
  // Strip a trailing "=?" / "= ?" / "=" which is common in question text.
  const cleaned = text.replace(/=\s*\??\s*$/, '').trim()
  if (cleaned.length === 0) return null

  // Reject anything but the safe character set.
  if (!/^[\d+\-*/×÷().,\s]+$/u.test(cleaned)) return null

  // Reject if there's no operator at all (a bare number isn't a problem to recompute).
  if (!/[+\-*/×÷]/.test(cleaned)) return null

  // Normalise unicode operators and remove thousands-style commas.
  const normalised = cleaned.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '')

  try {
    const fn = new Function(`"use strict"; return (${normalised});`)
    const result = fn()
    return typeof result === 'number' && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

/** Format a number for display, preferring integer output when exact. */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return String(parseFloat(n.toFixed(4)))
}

/**
 * True when text has no arithmetic operator and no digit — i.e. it's pure
 * instruction text like "חשב" or "Compute". The strategy can pass these
 * through unchanged without an eval check.
 */
function isInstructionOnly(text: string): boolean {
  return !/[\d+\-*/×÷]/.test(text)
}

/** Apply numeric swap + recompute to a section. Returns null if recompute is not safe. */
function rewriteSection(section: SectionLike, rng: () => number): SectionLike | null {
  const expressionText = section.text ?? ''
  const newText = rewriteNumbersInText(section.text, rng)

  // Pure instruction text (no operator, no digit) — pass through unchanged.
  const passThrough = expressionText.trim().length === 0 || isInstructionOnly(expressionText)

  let newAnswer = section.solution
  let newCorrectOption = section.correct_option
  if (!passThrough) {
    const evaluable = tryEvalArithmetic(expressionText)
    if (evaluable === null) return null

    const newEvaluable = newText ? tryEvalArithmetic(newText) : null
    if (newEvaluable === null) return null

    newAnswer = formatNumber(newEvaluable)
    newCorrectOption = newAnswer
  }

  return {
    ...section,
    text: newText,
    hint: rewriteNumbersInText(section.hint, rng),
    solution: newAnswer,
    full_solution: rewriteNumbersInText(section.full_solution, rng),
    correct_option: newCorrectOption,
    wrong_options: section.wrong_options?.map((opt) =>
      typeof opt === 'string' ? (rewriteNumbersInText(opt, rng) ?? opt) : opt,
    ),
  }
}

export class ScriptVariationStrategy implements VariationStrategy {
  readonly name = 'script'

  async apply(exercise: ExerciseLike, level: VariationLevel, seed = 1): Promise<VariationResult> {
    if (level !== 'light') {
      return {
        exercise,
        needsAiFallback: true,
        fallbackReason: `script strategy only supports level=light, got ${level}`,
      }
    }

    if (!isPurelyAlgebraic(exercise)) {
      return {
        exercise,
        needsAiFallback: true,
        fallbackReason: 'exercise is not purely algebraic',
      }
    }

    const rng = makeRng(seed)

    // Top-level rewrite. If `text` is just instruction (no operator/digit),
    // pass it through unchanged for evaluation purposes — the recompute only
    // runs on actual arithmetic expressions.
    const topExpr = exercise.text ?? ''
    const newText = rewriteNumbersInText(exercise.text, rng)
    const topPassThrough = topExpr.trim().length === 0 || isInstructionOnly(topExpr)

    let newTopEvaluable: number | null = null
    if (!topPassThrough) {
      const topEvaluable = tryEvalArithmetic(topExpr)
      if (topEvaluable === null) {
        return {
          exercise,
          needsAiFallback: true,
          fallbackReason: 'top-level expression is not a single safe arithmetic expression',
        }
      }
      newTopEvaluable = newText ? tryEvalArithmetic(newText) : null
      if (newTopEvaluable === null) {
        return {
          exercise,
          needsAiFallback: true,
          fallbackReason: 'rewritten top-level expression failed to evaluate',
        }
      }
    }

    const newSections: SectionLike[] = []
    for (const section of exercise.sections ?? []) {
      const rewritten = rewriteSection(section, rng)
      if (!rewritten) {
        return {
          exercise,
          needsAiFallback: true,
          fallbackReason: 'section text is not a single safe arithmetic expression',
        }
      }
      newSections.push(rewritten)
    }

    const newAnswer = newTopEvaluable === null ? exercise.solution : formatNumber(newTopEvaluable)

    const result: ExerciseLike = {
      ...exercise,
      text: newText,
      hint: rewriteNumbersInText(exercise.hint, rng),
      solution: newAnswer,
      full_solution: rewriteNumbersInText(exercise.full_solution, rng),
      correct_option: newTopEvaluable === null ? exercise.correct_option : newAnswer,
      wrong_options: exercise.wrong_options?.map((opt) =>
        typeof opt === 'string' ? (rewriteNumbersInText(opt, rng) ?? opt) : opt,
      ),
      sections: exercise.sections ? newSections : undefined,
    }

    return { exercise: result }
  }
}

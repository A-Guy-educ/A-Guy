/**
 * Script Variation Strategy
 *
 * @fileType utility
 * @domain lesson-duplication
 * @pattern script-variation
 * @ai-summary Deterministic numeric substitution strategy for purely-algebraic exercises at light level.
 */

import type { Exercise } from '@/payload-types'
import type {
  DuplicationLevel,
  DuplicationSubject,
} from '@/server/payload/collections/LessonDuplications'
import type { ContentBlock, InlineRichText } from '@/server/payload/collections/Exercises/types'
import type { VariationResult, VariationStrategy } from './types'
import { isPurelyAlgebraic } from './algebraic-detector'

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32 (copied from selectors.ts)
// ---------------------------------------------------------------------------

/** Generate a deterministic [0,1) float from a 32-bit integer state. */
function nextFloat(state: [number]): number {
  let s = state[0]
  s |= 0
  s = (s + 0x6d2b79f5) | 0
  const t = Math.imul(s ^ (s >>> 15), 1 | s)
  const result = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  state[0] = s
  return ((result ^ (result >>> 14)) >>> 0) / 4294967296
}

/** Deterministic 32-bit hash from a string (djb2). */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33 + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// ---------------------------------------------------------------------------
// Safe arithmetic eval
// ---------------------------------------------------------------------------

/** Matches a valid simple arithmetic expression: digits, operators, parens, dots, commas, spaces. */
const ARITHMETIC_EXPR_RE = /^[\d\s+\-*/×÷.,()]+$/

/**
 * Returns true only if `text` is a simple arithmetic expression with at least one operator.
 * Used to decide whether to auto-recompute the correct answer for MCQs.
 */
export function isSingleArithmeticExpression(text: string): boolean {
  const trimmed = text.trim()
  if (!ARITHMETIC_EXPR_RE.test(trimmed)) return false
  if (!/[+*/×÷-]/.test(trimmed)) return false // must have at least one operator
  return true
}

/**
 * Safely evaluate a simple arithmetic expression string.
 * Returns the numeric result, or null if evaluation fails.
 *
 * Uses a tight allowlist: only digits, basic operators, parens, dots, spaces, and '?'.
 */
function safeArithmeticEval(expr: string): number | null {
  try {
    // Normalise Unicode operators to ASCII and strip '?' and '='
    const normalized = expr
      .replace(/×|∗|⋅|•/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/[?=]/g, '')
      .trim()

    // Final safety: reject anything with non-math characters
    if (!/^[\d\s+\-*/().]+$/.test(normalized)) {
      return null
    }

    // Use Function constructor with an allowlist — limited scope but intentional
    const result = new Function(`"use strict"; return (${normalized})`)()
    if (typeof result !== 'number' || !isFinite(result)) return null
    return result
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Number replacement
// ---------------------------------------------------------------------------

/** Regex matching numeric literals (integers and decimals). */
const NUMERIC_LITERAL_RE = /\b\d+(?:\.\d+)?\b/g

/**
 * Determine if a string representation looks like an integer.
 */
function looksLikeInteger(str: string): boolean {
  return /^\d+$/.test(str)
}

/**
 * Determine decimal precision of a number string.
 */
function getPrecision(str: string): number {
  const idx = str.indexOf('.')
  if (idx === -1) return 0
  return str.length - idx - 1
}

/**
 * Generate a replacement value for a numeric literal.
 * Applies a factor in [0.7, 1.3] (i.e., ±30%) using a seeded PRNG.
 * Always produces a value that differs from the original.
 */
function generateReplacement(originalStr: string, seed: number): string {
  const originalValue = parseFloat(originalStr)
  if (isNaN(originalValue)) return originalStr

  const precision = getPrecision(originalStr)

  // Try multiple candidate factors; pick the first one that differs from the original.
  const candidates: number[] = []
  const state: [number] = [(seed ^ Math.round(originalValue * 1000)) >>> 0]

  for (let attempt = 0; attempt < 8; attempt++) {
    const factor = 0.7 + nextFloat(state) * 0.6 // 0.7 to 1.3
    const newValue = originalValue * factor
    const rounded = Math.round(newValue * Math.pow(10, precision)) / Math.pow(10, precision)
    const candidate = looksLikeInteger(originalStr) ? Math.round(rounded) : rounded
    if (candidate !== originalValue) {
      candidates.push(candidate)
      break
    }
    candidates.push(candidate) // store anyway for fallback
  }

  // Pick the first candidate that differs, otherwise fall back to ±1
  const different = candidates.find((c) => c !== originalValue)
  const replacement = different ?? (originalValue >= 1 ? originalValue - 1 : originalValue + 1)

  return String(replacement)
}

/**
 * Collect all unique numeric literals from a string.
 */
function collectNumbers(text: string): number[] {
  const matches = text.match(NUMERIC_LITERAL_RE)
  if (!matches) return []
  return [...new Set(matches.map((m) => parseFloat(m)))]
}

// ---------------------------------------------------------------------------
// Apply replacements to text
// ---------------------------------------------------------------------------

/**
 * Replace all occurrences of `originalStr` with `newStr` in `text`.
 */
function replaceNumber(text: string, originalStr: string, newStr: string): string {
  if (originalStr === newStr) return text
  // Escape special regex chars in originalStr so we match it literally.
  // No \b anchors — \b fails when a number is adjacent to Unicode operators
  // (×, ÷) because those are \w characters, leaving no word boundary.
  const escaped = originalStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped, 'g')
  return text.replace(re, newStr)
}

/**
 * Apply a number replacement map to all text in `texts`.
 * Returns new strings with replacements applied.
 */
function applyReplacementsToTexts(texts: string[], numberMap: Map<string, string>): string[] {
  return texts.map((text) => {
    let result = text
    for (const [original, replacement] of numberMap) {
      result = replaceNumber(result, original, replacement)
    }
    return result
  })
}

// ---------------------------------------------------------------------------
// MCQ recomputation
// ---------------------------------------------------------------------------

/** Generate wrong options by perturbing `correct` by ±15–25%. */
function generateWrongOptions(correct: number, seed: number, count = 3): number[] {
  const wrong: number[] = []
  const state: [number] = [(seed * 7919) >>> 0] // spread seed for perturbation

  const tried = new Set<number>()
  tried.add(correct)

  for (let i = 0; i < count; i++) {
    let perturbFactor = 0.75 + nextFloat(state) * 0.5 // 0.75 to 1.25
    let wrongValue = Math.round(correct * perturbFactor)

    // Ensure wrong value is different from correct
    if (wrongValue === correct || tried.has(wrongValue)) {
      const direction = nextFloat(state) > 0.5 ? 1 : -1
      wrongValue = correct + direction * (i + 1)
    }

    // Ensure uniqueness
    let attempts = 0
    while (tried.has(wrongValue) && attempts < 10) {
      const offset = nextFloat(state) > 0.5 ? 1 : -1
      wrongValue = correct + offset * (i + 1) * Math.sign(correct) * 10
      attempts++
    }

    tried.add(wrongValue)
    wrong.push(wrongValue)
  }

  return wrong
}

// ---------------------------------------------------------------------------
// Apply light variation
// ---------------------------------------------------------------------------

/**
 * Apply a deterministic light variation to a purely-algebraic exercise.
 *
 * - Swaps numeric literals in all text fields with values within ±30%.
 * - For single-arithmetic-expression MCQs: recomputes the correct answer and regenerates wrong options.
 * - Otherwise: marks as needsAiFallback (safe default — no bad answer is generated).
 */
export function applyScriptLightVariation(exercise: Exercise, seed: number): VariationResult {
  // Deep clone to avoid mutating the original
  const cloned = JSON.parse(JSON.stringify(exercise)) as Exercise
  const content = cloned.content as unknown as { blocks: ContentBlock[] }
  if (!content || !Array.isArray(content.blocks)) {
    return { exercise: cloned, needsAiFallback: true }
  }
  const blocks = content.blocks

  // Step 1: Collect all numbers from question blocks' prompt text
  const questionPrompts: string[] = []
  for (const block of blocks) {
    if (
      block.type === 'question_select' ||
      block.type === 'question_free_response' ||
      block.type === 'question_geometry' ||
      block.type === 'question_axis' ||
      block.type === 'question_matching'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = block as any
      if (b.prompt?.value) questionPrompts.push(b.prompt.value)
    }
  }

  if (questionPrompts.length === 0) {
    return { exercise: cloned, needsAiFallback: true }
  }

  // Step 2: Collect unique numbers from all question prompts
  const allNumbers = new Set<number>()
  for (const prompt of questionPrompts) {
    for (const num of collectNumbers(prompt)) {
      allNumbers.add(num)
    }
  }

  if (allNumbers.size === 0) {
    return { exercise: cloned, needsAiFallback: true }
  }

  // Step 3: Build replacement map
  const numberMap = new Map<string, string>()
  for (const num of allNumbers) {
    const originalStr = String(num)
    const replacementStr = generateReplacement(originalStr, seed ^ hashString(originalStr))
    numberMap.set(originalStr, replacementStr)
  }

  // Step 4: Apply replacements to all text fields in all blocks
  for (const block of blocks) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = block as any
    const textFields: (InlineRichText | undefined)[] = [
      b.prompt,
      b.hint,
      b.solution,
      b.fullSolution,
    ]
    for (const field of textFields) {
      if (field && typeof field.value === 'string') {
        const replacements = applyReplacementsToTexts([field.value], numberMap)
        field.value = replacements[0]
      }
    }

    // MCQ options
    if (b.answer?.options) {
      for (const option of b.answer.options) {
        if (option.content?.value) {
          const replacements = applyReplacementsToTexts([option.content.value], numberMap)
          option.content.value = replacements[0]
        }
      }
    }
  }

  // Step 5: Recompute MCQ answer if it's a single arithmetic expression
  const isAlgebraicMcq =
    blocks.length === 1 &&
    blocks[0].type === 'question_select' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (blocks[0] as any).variant === 'mcq'

  if (isAlgebraicMcq) {
    const mcqBlock = blocks[0] as {
      prompt?: InlineRichText
      answer?: {
        options: Array<{ id: string; content: InlineRichText }>
        correctOptionIds: string[]
      }
    }
    const promptValue = mcqBlock.prompt?.value ?? ''

    // Strip trailing '?' and '=' which are common in math prompts (e.g., "5×4=?" or "5×4=")
    const mathPrompt = promptValue.replace(/[?=]+$/, '').trim()
    const evalPrompt = mathPrompt.replace(/=/g, '').trim()
    if (isSingleArithmeticExpression(mathPrompt)) {
      // Evaluate with swapped numbers (apply replacements to the stripped eval prompt)
      const swappedEval = applyReplacementsToTexts([evalPrompt], numberMap)[0]
      const result = safeArithmeticEval(swappedEval)

      if (result !== null && Number.isFinite(result)) {
        const correctAnswer = Math.round(result)

        // Generate wrong options
        const wrongOptions = generateWrongOptions(correctAnswer, seed * 31 + 7)

        // Regenerate all options
        const newOptionIds: string[] = []
        mcqBlock.answer!.options = wrongOptions.map((wrongVal, i) => {
          const id = `opt-${i + 1}`
          newOptionIds.push(id)
          return {
            id,
            content: {
              type: 'rich_text' as const,
              format: 'md-math-v1' as const,
              value: String(wrongVal),
              mediaIds: [] as string[],
            },
          }
        })

        // Add correct answer as an additional option (to keep at least 2 options)
        const correctId = 'opt-correct'
        newOptionIds.push(correctId)
        mcqBlock.answer!.options.push({
          id: correctId,
          content: {
            type: 'rich_text' as const,
            format: 'md-math-v1' as const,
            value: String(correctAnswer),
            mediaIds: [] as string[],
          },
        })

        // Set correct option
        mcqBlock.answer!.correctOptionIds = [correctId]
      } else {
        // Expression couldn't be evaluated — fall back
        return { exercise: cloned, needsAiFallback: true }
      }
    } else {
      // Not a simple single arithmetic expression
      return { exercise: cloned, needsAiFallback: true }
    }
  }

  return { exercise: cloned }
}

// ---------------------------------------------------------------------------
// ScriptVariationStrategy
// ---------------------------------------------------------------------------

/**
 * Concrete variation strategy for light-level purely-algebraic exercises.
 * Falls through to AI for all other cases (non-algebraic, medium/deep, etc.).
 */
export class ScriptVariationStrategy implements VariationStrategy {
  async apply(
    exercise: Exercise,
    level: DuplicationLevel,
    _subject?: DuplicationSubject,
  ): Promise<VariationResult> {
    if (level === 'none') return { exercise }

    if (level !== 'light') {
      return { exercise, needsAiFallback: true }
    }

    if (!isPurelyAlgebraic(exercise)) {
      return { exercise, needsAiFallback: true }
    }

    // Derive deterministic seed from exercise ID
    const idStr = String(exercise.id ?? '')
    const seed = hashString(idStr)
    return applyScriptLightVariation(exercise, seed)
  }
}

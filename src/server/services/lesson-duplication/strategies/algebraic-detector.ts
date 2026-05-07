/**
 * Detects whether an exercise is "purely algebraic" — i.e. only numbers and
 * arithmetic operators, no SVG-dependent reasoning, no word-problem context.
 *
 * @fileType utility
 * @domain lessons
 * @pattern detector
 * @ai-summary Returns true only if every text field contains numbers/operators and a small math-word whitelist.
 *
 * The detector is deliberately conservative: any indication of a word problem,
 * geometric construction, or table/SVG reasoning falls back to "not algebraic"
 * and the orchestrator routes that exercise to the AI strategy.
 */

import type { ExerciseLike } from './types'

/**
 * Hebrew + English math-instruction words that DON'T disqualify an exercise.
 * Anything outside this set + numbers/operators counts as "word content".
 *
 * Keep this list short and obvious — false positives here cause wrong answers
 * downstream, so we'd rather under-detect and fall back to AI.
 */
const MATH_WORD_WHITELIST = new Set<string>([
  // Hebrew imperatives
  'חשב',
  'חשבו',
  'פתור',
  'פתרו',
  'מצא',
  'מצאו',
  'בדוק',
  'בדקו',
  'הסבר',
  'הסבירו',
  // English imperatives
  'compute',
  'solve',
  'find',
  'evaluate',
  'simplify',
  'calculate',
  // Filler
  'את',
  'the',
  'is',
  'a',
  'an',
])

/** Tokenise a string into "words" — runs of letters (Hebrew or Latin). */
function extractWords(text: string): string[] {
  return text.match(/[A-Za-z֐-׿]+/g) ?? []
}

/**
 * True when every word in `text` is in the math whitelist.
 * Empty / whitespace-only text counts as algebraic-friendly.
 */
function onlyMathWords(text: string): boolean {
  const words = extractWords(text)
  if (words.length === 0) return true
  return words.every((w) => MATH_WORD_WHITELIST.has(w.toLowerCase()))
}

/** True if SVG markup is present (anything beyond an empty/whitespace string). */
function hasSvgContent(svg: string | undefined): boolean {
  if (!svg) return false
  return svg.trim().length > 0
}

/** True if a table has any header or data row. */
function hasTableContent(table: ExerciseLike['table']): boolean {
  if (!table) return false
  const headerLen = Array.isArray(table.headers) ? table.headers.length : 0
  const rowLen = Array.isArray(table.rows_data) ? table.rows_data.length : 0
  return headerLen > 0 || rowLen > 0
}

/** True if a free-text field is algebraic-friendly: only whitelisted words (numbers always allowed). */
function fieldIsAlgebraic(text: string | undefined): boolean {
  if (!text || text.trim().length === 0) return true // empty is fine
  return onlyMathWords(text)
}

/**
 * Returns true if the exercise can be safely modified by deterministic numeric
 * substitution (the script-strategy light path). Returns false when the
 * exercise has SVG/table content, word-problem context, or any text the
 * detector can't confidently identify as "just math".
 */
export function isPurelyAlgebraic(exercise: ExerciseLike): boolean {
  if (hasSvgContent(exercise.svg)) return false
  if (hasTableContent(exercise.table)) return false

  const fields: Array<string | undefined> = [
    exercise.text,
    exercise.hint,
    exercise.solution,
    exercise.full_solution,
  ]

  for (const f of fields) {
    if (!fieldIsAlgebraic(f)) return false
  }

  for (const section of exercise.sections ?? []) {
    if (hasSvgContent(section.svg)) return false
    const sectionFields: Array<string | undefined> = [
      section.text,
      section.hint,
      section.solution,
      section.full_solution,
    ]
    for (const f of sectionFields) {
      if (!fieldIsAlgebraic(f)) return false
    }
  }

  return true
}

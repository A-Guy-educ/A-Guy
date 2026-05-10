/**
 * Algebraic Exercise Detector
 *
 * @fileType utility
 * @domain lesson-duplication
 * @pattern algebraic-detector
 * @ai-summary Pure-function detector that returns true only for exercises that can safely be varied by numeric substitution without AI.
 */

import type { Exercise } from '@/payload-types'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

// ---------------------------------------------------------------------------
// Whitelists
// ---------------------------------------------------------------------------

/** Hebrew school-math instruction words that do not disqualify an exercise. */
const HEBREW_MATH_WHITELIST = new Set<string>([
  // Common verbs
  'חשב',
  'פתור',
  'מצא',
  'סכם',
  'הפרש',
  'כפל',
  'חילוק',
  'שורש',
  'ריבוע',
  'זווית',
  'מעלה',
  'אחוז',
  // Nouns
  'שטח',
  'היקף',
  'נפח',
  'מרחק',
  'מהירות',
  'זמן',
  'כמות',
  'מספר',
  'ספרה',
  'ערך',
  'שווה',
  'קטן',
  'גדול',
  'בין',
  'או',
  'וגם',
  'אם',
  'אז',
  'לכן',
  'כי',
  'רלוונטי',
  'חידה',
  'תרגיל',
  'שאלה',
  'דוגמה',
  'הסבר',
  'פתרון',
  'תשובה',
  'בדיקה',
  'נכון',
  'לא',
  'איפה',
  'מתי',
  'כמה',
  'למה',
  'איך',
  // Hebrew math symbols that appear as text
  'שווה',
  'פלוס',
  'מינוס',
  'כפל',
  'חילוק',
])

/** English school-math instruction words that do not disqualify an exercise. */
const ENGLISH_MATH_WHITELIST = new Set<string>([
  'calculate',
  'solve',
  'find',
  'compute',
  'evaluate',
  'determine',
  'what',
  'is',
  'the',
  'sum',
  'difference',
  'product',
  'quotient',
  'of',
  'and',
  'plus',
  'minus',
  'times',
  'divided',
  'by',
  'equals',
  'equal',
  'result',
  'answer',
  'value',
  'number',
  'numbers',
])

// ---------------------------------------------------------------------------
// Block type helpers
// ---------------------------------------------------------------------------

/** Question-type block types (non-exhaustive — exercise must have at least one). */
const QUESTION_BLOCK_TYPES = new Set([
  'question_select',
  'question_free_response',
  'question_geometry',
  'question_axis',
  'question_matching',
])

/**
 * Returns true if `block` is a structural disqualifier for purely-algebraic detection.
 * SVG and table blocks cannot be safely varied by number-swapping alone.
 */
function isStructuralDisqualifier(block: ContentBlock): boolean {
  return block.type === 'svg' || block.type === 'question_table'
}

/**
 * Returns true if `block` is a question-type block.
 */
function isQuestionBlock(block: ContentBlock): boolean {
  return QUESTION_BLOCK_TYPES.has(block.type)
}

/**
 * Extract the prompt value from a question block (the text that defines the question).
 * Only the prompt is checked for algebraic content — hint/solution/fullSolution
 * can contain any text and are excluded to avoid false negatives.
 */
function extractPromptText(block: ContentBlock): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = block as any
  if (b.prompt && b.prompt.value && typeof b.prompt.value === 'string') {
    return b.prompt.value
  }
  return null
}

/**
 * After stripping digits, operators, and punctuation from `text`, returns true
 * if any Hebrew letter sequence ≥4 chars remains that is NOT in the whitelist.
 * Sequences ≥4 chars are content words (e.g., תרנגולות, מכוניות), not math variables.
 */
function hasNonWhitelistedHebrewContentWords(text: string): boolean {
  const stripped = text.replace(/[\d\s+\-×÷∗⋅•(),.=]/gu, '')
  const sequences = stripped.match(HEBREW_LETTER_SEQUENCE_RE) ?? []
  for (const seq of sequences) {
    if (seq.length >= 4 && !HEBREW_MATH_WHITELIST.has(seq)) {
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Hebrew / English sequence detection
// ---------------------------------------------------------------------------

/** Match a sequence of one or more Hebrew Unicode letters. */
const HEBREW_LETTER_SEQUENCE_RE = /[֐-׿]+/g

/** Match a sequence of two or more Latin letters (English word candidate). */
const ENGLISH_WORD_RE = /[a-zA-Z]{3,}/g

/**
 * Returns true if `text` contains any English word of length >= 3
 * that is NOT in the whitelist.
 */
function containsNonWhitelistedEnglish(text: string): boolean {
  const words = text.match(ENGLISH_WORD_RE) ?? []
  for (const word of words) {
    const lower = word.toLowerCase()
    if (!ENGLISH_MATH_WHITELIST.has(lower)) {
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Arithmetic operator detection
// ---------------------------------------------------------------------------

/** Matches arithmetic operator characters that appear in math exercises. */
const ARITHMETIC_OPERATOR_RE = /[+\-×÷∗⋅•]/u

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Returns `true` only if `exercise` is a "purely algebraic" exercise that can
 * safely be varied by deterministic numeric substitution without AI.
 *
 * An exercise is purely algebraic when:
 *  1. No SVG or table blocks are present.
 *  2. At least one question-type block exists.
 *  3. All question-type block text contains numbers AND at least one arithmetic operator.
 *  4. After stripping digits, operators, and whitelisted words, no Hebrew sequence ≥2
 *     or English word ≥3 remains.
 */
export function isPurelyAlgebraic(exercise: Exercise): boolean {
  const content = exercise.content as unknown as { blocks?: ContentBlock[] } | null
  if (!content || !Array.isArray(content.blocks)) {
    return false
  }

  const blocks = content.blocks

  // Rule 1: SVG or table blocks disqualify
  for (const block of blocks) {
    if (isStructuralDisqualifier(block)) {
      return false
    }
  }

  // Collect all question-type text fields
  const questionTexts: string[] = []
  for (const block of blocks) {
    if (isQuestionBlock(block)) {
      const promptText = extractPromptText(block)
      if (promptText !== null) {
        questionTexts.push(promptText)
      }
    }
  }

  // Rule 2: Must have at least one question-type block
  if (questionTexts.length === 0) {
    return false
  }

  // Check each prompt text field
  for (const text of questionTexts) {
    // Rule 3a: Must contain at least one arithmetic operator
    if (!ARITHMETIC_OPERATOR_RE.test(text)) {
      return false
    }

    // Rule 3b: Must contain at least one digit (otherwise it's just operators)
    if (!/\d/.test(text)) {
      return false
    }

    // Rule 3c: Check for non-whitelisted Hebrew content words (length ≥4)
    if (hasNonWhitelistedHebrewContentWords(text)) {
      return false
    }

    // Strip digits, operators, punctuation and check for English content words
    const stripped = text.replace(/[\d\s+\-×÷∗⋅•(),.=]/gu, '')

    if (containsNonWhitelistedEnglish(stripped)) {
      return false
    }
  }

  return true
}

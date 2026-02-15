/**
 * Answer normalization utilities for free-response validation
 * Pure functions for DB-based answer matching with flexible equivalence
 */

const WORD_TO_NUM: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
  // Hebrew
  אפס: 0,
  אחד: 1,
  שתיים: 2,
  שלוש: 3,
  ארבע: 4,
  חמש: 5,
  שש: 6,
  שבע: 7,
  שמונה: 8,
  תשע: 9,
  עשר: 10,
  עשרים: 20,
  שלושים: 30,
  ארבעים: 40,
  חמישים: 50,
  שישים: 60,
  שבעים: 70,
  שמונים: 80,
  תשעים: 90,
  מאה: 100,
}

export function normalizeText(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function extractNumeric(input: string): number | null {
  const stripped = input.replace(/[,%\s]/g, '').trim()
  if (stripped === '') return null
  const num = parseFloat(stripped)
  return isNaN(num) ? null : num
}

export function stripPercentSign(input: string): string {
  return input.replace(/%/g, '').trim()
}

export function wordToNumber(input: string): number | null {
  const normalized = normalizeText(input)
    .replace(/percent$/, '')
    .replace(/אחוז$/, '')
    .trim()
  return WORD_TO_NUM[normalized] ?? null
}

export function areNumericEquivalent(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001
}

export type MatchType = 'exact' | 'numeric' | 'word-number'

export interface MatchResult {
  matched: boolean
  matchType?: MatchType
}

export function matchAnswer(
  studentAnswer: string,
  acceptedAnswers: readonly string[],
): MatchResult {
  const studentNorm = normalizeText(studentAnswer)
  const studentNum = extractNumeric(studentAnswer)
  const studentWordNum = wordToNumber(studentAnswer)

  for (const accepted of acceptedAnswers) {
    const acceptedNorm = normalizeText(accepted)

    // 1. Exact text match (case-insensitive, trimmed)
    if (studentNorm === acceptedNorm) {
      return { matched: true, matchType: 'exact' }
    }

    // 2. Numeric equivalence (20% == 20 == 20.0)
    const acceptedNum = extractNumeric(accepted)
    if (
      studentNum !== null &&
      acceptedNum !== null &&
      areNumericEquivalent(studentNum, acceptedNum)
    ) {
      return { matched: true, matchType: 'numeric' }
    }

    // 3. Word-to-number: student writes "twenty", accepted is "20"
    if (
      studentWordNum !== null &&
      acceptedNum !== null &&
      areNumericEquivalent(studentWordNum, acceptedNum)
    ) {
      return { matched: true, matchType: 'word-number' }
    }

    // 4. Reverse: student writes "20", accepted is "twenty"
    const acceptedWordNum = wordToNumber(accepted)
    if (
      studentNum !== null &&
      acceptedWordNum !== null &&
      areNumericEquivalent(studentNum, acceptedWordNum)
    ) {
      return { matched: true, matchType: 'word-number' }
    }
  }

  return { matched: false }
}

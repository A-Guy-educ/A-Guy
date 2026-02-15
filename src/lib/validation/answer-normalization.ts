/**
 * Answer normalization utilities for free-response validation
 * Pure functions for DB-based answer matching with flexible equivalence
 */

import wordToNumData from './word-to-number.json'

const WORD_TO_NUM: Record<string, number> = wordToNumData

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

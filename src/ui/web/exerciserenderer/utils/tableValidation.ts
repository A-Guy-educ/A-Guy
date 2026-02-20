/**
 * Table Cell Validation
 * Client-side validation strategies for fillable table cells.
 * Strategies: exact string match → numeric match with tolerance.
 */

import type { TableCellResult } from '../types'

const NUMERIC_TOLERANCE = 0.01

/**
 * Normalize a string for comparison: trim, lowercase, collapse whitespace,
 * strip LaTeX wrappers ($...$) and common markdown formatting.
 */
function normalizeForComparison(value: string): string {
  let s = value.trim().toLowerCase()
  // Strip inline LaTeX wrappers
  s = s.replace(/^\$+|\$+$/g, '')
  // Strip bold/italic markdown
  s = s.replace(/\*{1,3}/g, '')
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ')
  return s.trim()
}

/**
 * Parse a value as a number, handling RTL minus convention
 * where trailing minus (e.g. "4-") means negative (e.g. "-4").
 */
function parseNumeric(value: string): number | null {
  const cleaned = normalizeForComparison(value)
  if (cleaned === '') return null

  // Handle RTL trailing minus: "4-" → "-4"
  let numStr = cleaned
  if (numStr.endsWith('-') && !numStr.startsWith('-')) {
    numStr = '-' + numStr.slice(0, -1)
  }

  const parsed = parseFloat(numStr)
  return isNaN(parsed) ? null : parsed
}

/**
 * Check if a student answer matches the expected answer for a single cell.
 */
export function validateCell(studentValue: string, expectedValue: string): boolean {
  // Strategy 1: Exact string match (normalized)
  if (normalizeForComparison(studentValue) === normalizeForComparison(expectedValue)) {
    return true
  }

  // Strategy 2: Numeric match with tolerance
  const studentNum = parseNumeric(studentValue)
  const expectedNum = parseNumeric(expectedValue)
  if (studentNum !== null && expectedNum !== null) {
    return Math.abs(studentNum - expectedNum) <= NUMERIC_TOLERANCE
  }

  return false
}

/**
 * Validate all fillable cells in a table against the answer key.
 * Returns per-cell results and an overall isCorrect flag.
 */
export function validateTableAnswers(
  cellValues: Record<string, string>,
  answers: Record<string, string>,
): { cellResults: TableCellResult[]; allCorrect: boolean } {
  const cellResults: TableCellResult[] = []
  let allCorrect = true

  for (const [key, expected] of Object.entries(answers)) {
    const studentValue = cellValues[key] ?? ''
    const isCorrect = validateCell(studentValue, expected)
    cellResults.push({ key, isCorrect })
    if (!isCorrect) allCorrect = false
  }

  return { cellResults, allCorrect }
}

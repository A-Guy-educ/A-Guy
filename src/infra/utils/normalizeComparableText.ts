/**
 * Normalize Comparable Text Utility
 *
 * Provides consistent text normalization for comparison purposes.
 * Used by header components to prevent duplicate rendering when
 * title and description are textually equivalent.
 *
 * Normalization steps:
 * 1. trim() - Remove leading/trailing whitespace
 * 2. replace(/\s+/g, ' ') - Collapse multiple spaces to single space
 * 3. toLowerCase() - Convert to lowercase
 *
 * This ensures that strings differing only in:
 * - Whitespace (leading, trailing, or multiple spaces)
 * - Case (uppercase vs lowercase)
 *
 * Are considered equivalent.
 *
 * @example
 * normalizeComparableText("Hello World") === normalizeComparableText("  HELLO   WORLD  ")
 * // true
 *
 * @example
 * normalizeComparableText("Introduction") === normalizeComparableText("Introduction to Programming")
 * // false
 */
export function normalizeComparableText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

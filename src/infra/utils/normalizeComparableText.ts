/**
 * Normalize text for comparison by handling Unicode, whitespace, and case.
 * Used by header components to prevent duplicate rendering.
 */
export function normalizeComparableText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
}

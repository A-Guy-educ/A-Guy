/**
 * Shared diff utility for comparing exercise block arrays.
 *
 * Single source of truth — imported by:
 * - Server: src/server/services/lesson-duplication/diff.ts
 * - Client: src/ui/admin/LessonDuplicationReview/lib/diff.ts
 *
 * This file lives in src/utils/ (no layer restrictions) so it can be safely
 * imported from both the server and UI layers. The ContentBlock type is a
 * pure TypeScript interface with no runtime server dependencies.
 *
 * @fileType utility
 * @domain lesson-duplication
 * @pattern diff-classifier
 * @ai-summary Classifies the type of difference between two exercise block arrays.
 */
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

/** Categories for source-vs-output block differences. */
export type DiffCategory = 'identical' | 'numeric_only' | 'phrasing_changed' | 'structural_diff'

/**
 * Determines whether two block arrays are byte-equal.
 */
export function byteEqual(a: ContentBlock[], b: ContentBlock[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Checks structural equality — same block count and same type at each index.
 * Returns true if structurally equal.
 */
export function blockStructuralEqual(a: ContentBlock[], b: ContentBlock[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].type !== b[i].type) return false
    // Both blocks are plain objects → verify key shape matches too
    if (
      typeof a[i] === 'object' &&
      typeof b[i] === 'object' &&
      a[i] !== null &&
      b[i] !== null &&
      !Array.isArray(a[i]) &&
      !Array.isArray(b[i])
    ) {
      const aKeys = Object.keys(a[i] as object)
      const bKeys = Object.keys(b[i] as object)
      if (aKeys.length !== bKeys.length) return false
    }
  }
  return true
}

/**
 * Checks whether every difference between two values is a numeric one.
 * Returns true only if ALL value diffs are number-vs-number.
 * String diffs, type mismatches, or missing keys return false.
 *
 * @param left - first value
 * @param right - second value
 */
export function numericDifferencesOnly(left: unknown, right: unknown): boolean {
  // Different types at the top level → not numeric-only
  if (typeof left !== typeof right) return false

  // Primitive values
  if (typeof left !== 'object' || left === null || right === null) {
    if (left === right) return true // identical
    // Different primitives — only number-vs-number is acceptable
    return typeof left === 'number' && typeof right === 'number'
  }

  // Arrays — must match in length
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false
    for (let i = 0; i < left.length; i++) {
      if (!numericDifferencesOnly(left[i], right[i])) return false
    }
    return true
  }

  // Objects — recurse on all keys present in either side
  if (Array.isArray(left) || Array.isArray(right)) return false

  const leftObj = left as Record<string, unknown>
  const rightObj = right as Record<string, unknown>
  const leftKeys = Object.keys(leftObj)
  const rightKeys = Object.keys(rightObj)

  // Different key counts → structural mismatch
  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  // Compare per-key values
  for (const key of leftKeys) {
    const leftVal = leftObj[key]
    const rightVal = rightObj[key]

    if (!numericDifferencesOnly(leftVal, rightVal)) return false
  }

  return true
}

/**
 * Classifies the difference between two exercise block arrays into one of four categories.
 *
 * Algorithm:
 * 1. byteEqual(a, b) → 'identical' if JSON stringify matches
 * 2. blockStructuralEqual(a, b) → 'structural_diff' if block count or type at any index differs
 * 3. numericDifferencesOnly(a, b) → 'numeric_only' if every diff is a number literal
 * 4. else → 'phrasing_changed'
 *
 * @param sourceBlocks - the source exercise block array
 * @param outputBlocks - the generated variation block array
 */
export function classifyDiff(
  sourceBlocks: ContentBlock[],
  outputBlocks: ContentBlock[],
): DiffCategory {
  // Step 1: identical check
  if (byteEqual(sourceBlocks, outputBlocks)) return 'identical'

  // Step 2: structural diff check
  if (!blockStructuralEqual(sourceBlocks, outputBlocks)) return 'structural_diff'

  // Step 3: numeric-only check
  if (!numericDifferencesOnly(sourceBlocks, outputBlocks)) return 'phrasing_changed'

  return 'numeric_only'
}

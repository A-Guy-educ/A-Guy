/**
 * Diff utility for comparing exercise block arrays.
 * Re-exports the shared implementation from @/utils/diff.
 *
 * @fileType utility
 * @domain lesson-duplication
 * @pattern diff-classifier
 * @ai-summary Classifies the type of difference between two exercise block arrays.
 */
export {
  byteEqual,
  blockStructuralEqual,
  classifyDiff,
  numericDifferencesOnly,
  type DiffCategory,
} from '@/utils/diff'

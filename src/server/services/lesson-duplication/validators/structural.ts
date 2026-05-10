/**
 * Structural Validator — per-exercise Zod checks for lesson duplication.
 *
 * Checks (in order, all failures collected, never thrown):
 *  1. blocks.length <= 5  → TOO_MANY_SECTIONS
 *  2. No embedded PNG data in any block value string → PNG_FORBIDDEN
 *  3. SVG blocks: value is empty OR starts with '<svg' → INVALID_SVG
 *  4. All question blocks have non-empty prompt → MISSING_QUESTION (maps to question prompt)
 *  5. All question blocks have hint → MISSING_HINT
 *  6. All question blocks have solution → MISSING_SOLUTION
 *  7. All question blocks have fullSolution → MISSING_FULL_SOLUTION
 *  8. MCQ blocks have at least 2 options (≥1 wrong option) → MISSING_WRONG_OPTIONS
 *  9. MCQ blocks have correctOptionIds non-empty → MISSING_CORRECT_OPTION
 */

import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'

export const FAILURE_CODES = {
  TOO_MANY_SECTIONS: 'TOO_MANY_SECTIONS',
  PNG_FORBIDDEN: 'PNG_FORBIDDEN',
  INVALID_SVG: 'INVALID_SVG',
  MISSING_QUESTION: 'MISSING_QUESTION',
  MISSING_HINT: 'MISSING_HINT',
  MISSING_SOLUTION: 'MISSING_SOLUTION',
  MISSING_FULL_SOLUTION: 'MISSING_FULL_SOLUTION',
  MISSING_CORRECT_OPTION: 'MISSING_CORRECT_OPTION',
  MISSING_WRONG_OPTIONS: 'MISSING_WRONG_OPTIONS',
} as const

export type FailureCode = (typeof FAILURE_CODES)[keyof typeof FAILURE_CODES]

export interface StructuralFailure {
  code: FailureCode
  message: string
  blockIndex?: number
}

/** Returns true if the string contains embedded PNG data (data URI or .png reference). */
function containsPngData(value: string): boolean {
  // data:image/png;base64,... or data:image/png,...
  if (/data:image\/png/i.test(value)) return true
  // Reference to .png file (not a data URI)
  if (/\.png["')\s]/i.test(value)) return true
  return false
}

/** Returns true if the SVG block value is populated but does not start with '<svg'. */
function isInvalidSvg(block: { value: string }): boolean {
  const v = block.value.trim()
  if (v === '') return false // empty is allowed
  return !v.startsWith('<svg')
}

/** Check a single block for structural failures.
 *  Returns array of failures (empty = pass).
 */
function validateBlock(block: ContentBlock, blockIndex: number): StructuralFailure[] {
  const failures: StructuralFailure[] = []

  // SVG block: value must be empty or start with <svg
  if (block.type === 'svg') {
    if (isInvalidSvg(block)) {
      failures.push({
        code: FAILURE_CODES.INVALID_SVG,
        message: `SVG block at index ${blockIndex} has non-empty value that does not start with '<svg'`,
        blockIndex,
      })
    }
    // PNG check on SVG value
    if (containsPngData(block.value)) {
      failures.push({
        code: FAILURE_CODES.PNG_FORBIDDEN,
        message: `SVG block at index ${blockIndex} contains PNG data`,
        blockIndex,
      })
    }
  }

  // Rich text blocks: check value for PNG
  if (block.type === 'rich_text' && containsPngData(block.value)) {
    failures.push({
      code: FAILURE_CODES.PNG_FORBIDDEN,
      message: `Rich text block at index ${blockIndex} contains PNG data`,
      blockIndex,
    })
  }

  // HTML blocks: check html field for PNG
  if (block.type === 'html') {
    const htmlValue = (block as { html?: string }).html ?? ''
    if (containsPngData(htmlValue)) {
      failures.push({
        code: FAILURE_CODES.PNG_FORBIDDEN,
        message: `HTML block at index ${blockIndex} contains PNG data`,
        blockIndex,
      })
    }
  }

  // Question blocks: check required fields
  if (
    block.type === 'question_select' ||
    block.type === 'question_free_response' ||
    block.type === 'question_table' ||
    block.type === 'question_matching' ||
    block.type === 'question_geometry' ||
    block.type === 'question_axis'
  ) {
    // prompt check — always required
    const prompt = (block as { prompt?: { value?: string } }).prompt
    if (!prompt?.value?.trim()) {
      failures.push({
        code: FAILURE_CODES.MISSING_QUESTION,
        message: `Question block at index ${blockIndex} missing prompt`,
        blockIndex,
      })
    }

    // hint check
    const hint = (block as { hint?: { value?: string } }).hint
    if (!hint?.value?.trim()) {
      failures.push({
        code: FAILURE_CODES.MISSING_HINT,
        message: `Question block at index ${blockIndex} missing hint`,
        blockIndex,
      })
    }

    // solution check
    const solution = (block as { solution?: { value?: string } }).solution
    if (!solution?.value?.trim()) {
      failures.push({
        code: FAILURE_CODES.MISSING_SOLUTION,
        message: `Question block at index ${blockIndex} missing solution`,
        blockIndex,
      })
    }

    // fullSolution check
    const fullSolution = (block as { fullSolution?: { value?: string } }).fullSolution
    if (!fullSolution?.value?.trim()) {
      failures.push({
        code: FAILURE_CODES.MISSING_FULL_SOLUTION,
        message: `Question block at index ${blockIndex} missing fullSolution`,
        blockIndex,
      })
    }

    // MCQ-specific checks
    if (block.type === 'question_select' && (block as { variant?: string }).variant === 'mcq') {
      const mcqBlock = block as {
        answer: { correctOptionIds?: string[]; options?: unknown[] }
      }
      if (!mcqBlock.answer.correctOptionIds || mcqBlock.answer.correctOptionIds.length === 0) {
        failures.push({
          code: FAILURE_CODES.MISSING_CORRECT_OPTION,
          message: `MCQ block at index ${blockIndex} missing correctOptionIds`,
          blockIndex,
        })
      }
      if (!mcqBlock.answer.options || mcqBlock.answer.options.length < 2) {
        failures.push({
          code: FAILURE_CODES.MISSING_WRONG_OPTIONS,
          message: `MCQ block at index ${blockIndex} must have at least 2 wrong options`,
          blockIndex,
        })
      }
    }
  }

  return failures
}

/**
 * Validate a single exercise's content blocks for structural correctness.
 * Returns an array of failures (empty = valid).
 */
export function validateExerciseStructural(blocks: ContentBlock[]): StructuralFailure[] {
  const failures: StructuralFailure[] = []

  // 1. Block count check
  if (blocks.length > 5) {
    failures.push({
      code: FAILURE_CODES.TOO_MANY_SECTIONS,
      message: `Exercise has ${blocks.length} blocks, maximum allowed is 5`,
    })
  }

  // 2. Per-block validation
  for (let i = 0; i < blocks.length; i++) {
    failures.push(...validateBlock(blocks[i], i))
  }

  return failures
}

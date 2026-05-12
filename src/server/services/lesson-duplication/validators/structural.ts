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
import { GeometrySpecV1Schema } from '@/infra/contracts/graphics/geometry.v1'
import { AxisSpecV1Schema } from '@/infra/contracts/graphics/axis.v1'
import { GuidedExplanationV1Schema } from '@/infra/contracts/guided-explanation/v1'

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
  INVALID_GEOMETRY_SPEC: 'INVALID_GEOMETRY_SPEC',
  INVALID_AXIS_SPEC: 'INVALID_AXIS_SPEC',
  INVALID_GUIDED_EXPLANATION: 'INVALID_GUIDED_EXPLANATION',
} as const

export type FailureCode = (typeof FAILURE_CODES)[keyof typeof FAILURE_CODES]

export interface StructuralFailure {
  code: FailureCode
  message: string
  blockIndex?: number
}

/**
 * Failure codes that DROP the exercise from the output lesson — these usually
 * mean the renderer will crash, the exercise is unsalvageable without a
 * second AI pass, or we can't synthesize a sane placeholder for the missing
 * data. The rest are recorded as warnings and the exercise lands in the
 * output with placeholder text for the missing field.
 *
 * MISSING_CORRECT_OPTION / MISSING_WRONG_OPTIONS are blocking because we
 * can't invent plausible MCQ options without knowing the subject matter —
 * a "_TODO_" option set would make the exercise unanswerable, and would
 * then fail McqAnswerSchema's min(2) requirement at save time anyway,
 * producing a duplicate GENERATION_FAILED on top of the warning.
 */
export const BLOCKING_FAILURE_CODES = new Set<FailureCode>([
  FAILURE_CODES.PNG_FORBIDDEN,
  FAILURE_CODES.INVALID_SVG,
  FAILURE_CODES.INVALID_GEOMETRY_SPEC,
  FAILURE_CODES.INVALID_AXIS_SPEC,
  FAILURE_CODES.INVALID_GUIDED_EXPLANATION,
  FAILURE_CODES.TOO_MANY_SECTIONS,
  FAILURE_CODES.MISSING_QUESTION,
  FAILURE_CODES.MISSING_CORRECT_OPTION,
  FAILURE_CODES.MISSING_WRONG_OPTIONS,
])

/**
 * Return a NEW array of new block objects with missing hint / solution /
 * fullSolution fields filled with TODO placeholders. Used after structural
 * validation when only warning-level failures remain.
 *
 * Pure: does not mutate `blocks` or any block it contains.
 */
export function fillMissingFieldsWithPlaceholders(blocks: ContentBlock[]): ContentBlock[] {
  const placeholder = (label: string) =>
    ({
      type: 'rich_text' as const,
      format: 'md-math-v1' as const,
      value: `_TODO: ${label} not provided by AI — please fill in_`,
      mediaIds: [] as string[],
    }) satisfies Record<string, unknown>

  const QUESTION_TYPES = new Set([
    'question_select',
    'question_free_response',
    'question_table',
    'question_matching',
    'question_geometry',
    'question_axis',
  ])

  return blocks.map((block) => {
    if (!QUESTION_TYPES.has(block.type)) return block
    const b = block as Record<string, unknown> & {
      hint?: { value?: string }
      solution?: { value?: string }
      fullSolution?: { value?: string }
    }
    const next: Record<string, unknown> = { ...b }
    if (!b.hint?.value?.trim()) next.hint = placeholder('hint')
    if (!b.solution?.value?.trim()) next.solution = placeholder('solution')
    if (!b.fullSolution?.value?.trim()) next.fullSolution = placeholder('full solution')
    return next as ContentBlock
  })
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

  // Schema-level validation for spec blocks

  // question_geometry: validate geometry field against GeometrySpecV1Schema
  if (block.type === 'question_geometry') {
    const geometry = (block as { geometry?: unknown }).geometry
    if (geometry !== undefined) {
      const result = GeometrySpecV1Schema.safeParse(geometry)
      if (!result.success) {
        failures.push({
          code: FAILURE_CODES.INVALID_GEOMETRY_SPEC,
          message: `question_geometry block at index ${blockIndex}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          blockIndex,
        })
      }
    }
  }

  // question_axis: validate axis field against AxisSpecV1Schema
  if (block.type === 'question_axis') {
    const axis = (block as { axis?: unknown }).axis
    if (axis !== undefined) {
      const result = AxisSpecV1Schema.safeParse(axis)
      if (!result.success) {
        failures.push({
          code: FAILURE_CODES.INVALID_AXIS_SPEC,
          message: `question_axis block at index ${blockIndex}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          blockIndex,
        })
      }
    }
  }

  // question_multi_axis: validate each graph's axis field against AxisSpecV1Schema
  if (block.type === 'question_multi_axis') {
    const graphs = (block as { graphs?: Array<{ id?: string; axis?: unknown }> }).graphs ?? []
    for (const graph of graphs) {
      if (graph.axis !== undefined) {
        const result = AxisSpecV1Schema.safeParse(graph.axis)
        if (!result.success) {
          failures.push({
            code: FAILURE_CODES.INVALID_AXIS_SPEC,
            message: `question_multi_axis block at index ${blockIndex}, graph "${graph.id ?? '?'}": ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
            blockIndex,
          })
        }
      }
    }
  }

  // html blocks: validate guidedExplanation against GuidedExplanationV1Schema (when present)
  if (block.type === 'html') {
    const guidedExplanation = (block as { guidedExplanation?: unknown }).guidedExplanation
    if (guidedExplanation !== undefined) {
      const result = GuidedExplanationV1Schema.safeParse(guidedExplanation)
      if (!result.success) {
        failures.push({
          code: FAILURE_CODES.INVALID_GUIDED_EXPLANATION,
          message: `HTML block at index ${blockIndex} guidedExplanation: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
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

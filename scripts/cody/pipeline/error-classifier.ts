/**
 * @fileType utility
 * @domain cody | pipeline | errors
 * @pattern error-classification
 * @ai-summary Classifies build/test/lint errors and formats them as actionable markdown for autofix agent
 */

// ============================================================================
// Types
// ============================================================================

export type ErrorCategory =
  | 'type_error'
  | 'lint_error'
  | 'format_error'
  | 'test_failure'
  | 'unknown'

export interface ClassifiedError {
  category: ErrorCategory
  summary: string
  fullOutput: string
  fileHints: string[]
  fixInstructions: string
}

// ============================================================================
// Constants
// ============================================================================

const MAX_OUTPUT_LENGTH = 5000
const MAX_SUMMARY_LENGTH = 500

const FIX_INSTRUCTIONS: Record<ErrorCategory, string> = {
  type_error:
    'Fix TypeScript type errors. Check the affected files for type mismatches, missing imports, or incorrect function signatures.',
  lint_error: 'Fix lint errors. Run `pnpm lint:fix` first, then manually fix any remaining issues.',
  format_error: 'Fix format errors. Run `pnpm format:fix` to auto-format all files.',
  test_failure:
    'Fix failing test(s). Read the test expectations carefully and update the source code (not the tests) to make them pass.',
  unknown: 'Unknown error type. Read the full output below and fix the underlying issue.',
}

// ============================================================================
// Regex patterns
// ============================================================================

/** Matches TSC output like: src/foo.ts(10,5): error TS2345: ... */
const TSC_FILE_REGEX = /([^\s:]+\.tsx?)\(\d+,\d+\)/g

/** Matches vitest FAIL lines like: FAIL tests/unit/foo.test.ts > should work */
const TEST_FILE_REGEX = /(?:FAIL|❌)\s+(\S+\.(?:test|spec)\.\w+)/g

/** Matches eslint file paths from output like: /path/to/src/foo.ts */
const LINT_FILE_REGEX = /^(\/\S+\.(?:ts|tsx|js|jsx))$/gm

/** Matches prettier [warn] lines with file paths */
const FORMAT_FILE_REGEX = /\[warn\]\s+(\S+\.\w+)/g

// ============================================================================
// Functions
// ============================================================================

/**
 * Classify a raw error output string into a structured error object.
 *
 * @param rawOutput - The raw stderr/stdout from the failed command
 * @param source - What generated this output: 'tsc', 'test', 'lint', 'format'
 */
export function classifyError(rawOutput: string, source: string): ClassifiedError {
  if (!rawOutput || rawOutput.trim().length === 0) {
    return {
      category: 'unknown',
      summary: 'Empty error output',
      fullOutput: '',
      fileHints: [],
      fixInstructions: FIX_INSTRUCTIONS.unknown,
    }
  }

  const truncatedOutput =
    rawOutput.length > MAX_OUTPUT_LENGTH ? rawOutput.slice(0, MAX_OUTPUT_LENGTH) : rawOutput

  const summary =
    rawOutput.length > MAX_SUMMARY_LENGTH ? rawOutput.slice(0, MAX_SUMMARY_LENGTH) : rawOutput

  switch (source) {
    case 'tsc': {
      const fileHints = extractUniqueFiles(rawOutput, TSC_FILE_REGEX)
      return {
        category: 'type_error',
        summary,
        fullOutput: truncatedOutput,
        fileHints,
        fixInstructions: FIX_INSTRUCTIONS.type_error,
      }
    }

    case 'test': {
      const fileHints = extractUniqueFiles(rawOutput, TEST_FILE_REGEX)
      return {
        category: 'test_failure',
        summary,
        fullOutput: truncatedOutput,
        fileHints,
        fixInstructions: FIX_INSTRUCTIONS.test_failure,
      }
    }

    case 'lint': {
      const fileHints = extractUniqueFiles(rawOutput, LINT_FILE_REGEX)
      return {
        category: 'lint_error',
        summary,
        fullOutput: truncatedOutput,
        fileHints,
        fixInstructions: FIX_INSTRUCTIONS.lint_error,
      }
    }

    case 'format': {
      const fileHints = extractUniqueFiles(rawOutput, FORMAT_FILE_REGEX)
      return {
        category: 'format_error',
        summary,
        fullOutput: truncatedOutput,
        fileHints,
        fixInstructions: FIX_INSTRUCTIONS.format_error,
      }
    }

    default: {
      return {
        category: 'unknown',
        summary,
        fullOutput: truncatedOutput,
        fileHints: [],
        fixInstructions: FIX_INSTRUCTIONS.unknown,
      }
    }
  }
}

/**
 * Format an array of classified errors into a markdown document for the autofix agent.
 *
 * @param errors - Array of classified errors from failed quality gates
 * @param attempt - Current attempt number (1-indexed)
 * @param maxAttempts - Maximum number of autofix attempts
 */
export function formatErrorsAsMarkdown(
  errors: ClassifiedError[],
  attempt: number,
  maxAttempts: number,
): string {
  const sections = errors.map((error, i) => {
    const fileList =
      error.fileHints.length > 0
        ? `\n**Affected Files**:\n${error.fileHints.map((f) => `- \`${f}\``).join('\n')}`
        : ''

    return `## Error ${i + 1}: ${error.category}

**Fix Instructions**: ${error.fixInstructions}
${fileList}

**Error Output**:
\`\`\`
${error.fullOutput}
\`\`\`
`
  })

  return `# Build Errors

Attempt ${attempt}/${maxAttempts}. Fix the errors below and the quality gates will be re-run.

${sections.join('\n---\n\n')}
`
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract unique file paths from a string using a regex.
 * The regex must have a capture group for the file path.
 */
function extractUniqueFiles(text: string, regex: RegExp): string[] {
  const files = new Set<string>()
  let match: RegExpExecArray | null

  // Reset regex state (global regexes are stateful)
  regex.lastIndex = 0

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      files.add(match[1])
    }
  }

  return Array.from(files)
}

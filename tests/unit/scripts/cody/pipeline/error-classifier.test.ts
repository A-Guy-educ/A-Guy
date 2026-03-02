import { describe, it, expect } from 'vitest'
import {
  classifyError,
  formatErrorsAsMarkdown,
  type ErrorCategory,
} from '../../../../../scripts/cody/pipeline/error-classifier'

describe('classifyError', () => {
  describe('TypeScript errors', () => {
    it('classifies tsc output as type_error with file hints', () => {
      const raw =
        "src/foo.ts(10,5): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'."
      const result = classifyError(raw, 'tsc')
      expect(result.category).toBe('type_error')
      expect(result.fileHints).toContain('src/foo.ts')
      expect(result.fixInstructions).toContain('TypeScript')
    })

    it('extracts multiple file paths from multi-error tsc output', () => {
      const raw = [
        'src/foo.ts(10,5): error TS2345: Argument...',
        'src/bar.ts(20,3): error TS2322: Type...',
        'src/foo.ts(15,1): error TS2554: Expected 2 arguments',
      ].join('\n')
      const result = classifyError(raw, 'tsc')
      expect(result.category).toBe('type_error')
      expect(result.fileHints).toContain('src/foo.ts')
      expect(result.fileHints).toContain('src/bar.ts')
      // Should deduplicate
      expect(result.fileHints.filter((f) => f === 'src/foo.ts')).toHaveLength(1)
    })
  })

  describe('test failures', () => {
    it('classifies vitest output as test_failure with file hints', () => {
      const raw = 'FAIL tests/unit/foo.test.ts > should work\n  Expected: true\n  Received: false'
      const result = classifyError(raw, 'test')
      expect(result.category).toBe('test_failure')
      expect(result.fileHints).toContain('tests/unit/foo.test.ts')
      expect(result.fixInstructions).toContain('test')
    })
  })

  describe('lint errors', () => {
    it('classifies eslint output as lint_error', () => {
      const raw =
        '/path/to/src/foo.ts\n  10:5  error  Unexpected any  @typescript-eslint/no-explicit-any'
      const result = classifyError(raw, 'lint')
      expect(result.category).toBe('lint_error')
      expect(result.fixInstructions).toContain('lint')
    })
  })

  describe('format errors', () => {
    it('classifies prettier output as format_error', () => {
      const raw = 'Checking formatting...\n[warn] src/foo.ts\n[warn] Code style issues found'
      const result = classifyError(raw, 'format')
      expect(result.category).toBe('format_error')
      expect(result.fixInstructions).toContain('format')
    })
  })

  describe('edge cases', () => {
    it('returns unknown for empty input', () => {
      const result = classifyError('', 'tsc')
      expect(result.category).toBe('unknown')
    })

    it('truncates fullOutput to 5000 chars', () => {
      const long = 'x'.repeat(10000)
      const result = classifyError(long, 'tsc')
      expect(result.fullOutput.length).toBeLessThanOrEqual(5000)
    })

    it('truncates summary to 500 chars', () => {
      const long = 'x'.repeat(2000)
      const result = classifyError(long, 'tsc')
      expect(result.summary.length).toBeLessThanOrEqual(500)
    })
  })
})

describe('formatErrorsAsMarkdown', () => {
  it('produces markdown with attempt info and error sections', () => {
    const errors = [
      {
        category: 'type_error' as ErrorCategory,
        summary: 'TS2345 in foo.ts',
        fullOutput: 'src/foo.ts(10,5): error TS2345: Argument...',
        fileHints: ['src/foo.ts'],
        fixInstructions: 'Fix TypeScript type errors.',
      },
    ]
    const md = formatErrorsAsMarkdown(errors, 1, 2)
    expect(md).toContain('# Build Errors')
    expect(md).toContain('Attempt 1/2')
    expect(md).toContain('type_error')
    expect(md).toContain('src/foo.ts')
    expect(md).toContain('Fix TypeScript type errors')
  })

  it('includes multiple error sections for different categories', () => {
    const errors = [
      {
        category: 'type_error' as ErrorCategory,
        summary: 'tsc',
        fullOutput: 'err1',
        fileHints: ['a.ts'],
        fixInstructions: 'fix types',
      },
      {
        category: 'test_failure' as ErrorCategory,
        summary: 'test',
        fullOutput: 'err2',
        fileHints: ['b.test.ts'],
        fixInstructions: 'fix tests',
      },
    ]
    const md = formatErrorsAsMarkdown(errors, 2, 2)
    expect(md).toContain('type_error')
    expect(md).toContain('test_failure')
    expect(md).toContain('a.ts')
    expect(md).toContain('b.test.ts')
  })
})

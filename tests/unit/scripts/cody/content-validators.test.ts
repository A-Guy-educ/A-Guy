/**
 * @fileType test
 * @domain ci | cody
 * @pattern content-validation
 * @ai-summary Tests for content-validators.ts - pure validation functions for pipeline stage outputs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  checkForQuestions,
  validateSpecContent,
  validateSpecFile,
  validateBuildReport,
  validateBuildFile,
  isPlanReviewFail,
  validatePlanReviewVerdict,
  extractVerifySummary,
  isVerifyFailed,
} from '../../../../scripts/cody/content-validators'

describe('content-validators', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-validators-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  // ========================================================================
  // checkForQuestions
  // ========================================================================

  describe('checkForQuestions', () => {
    it('returns false for empty file', () => {
      const filePath = path.join(tempDir, 'questions.md')
      fs.writeFileSync(filePath, '')
      expect(checkForQuestions(filePath)).toBe(false)
    })

    it('returns false for short placeholder text', () => {
      const filePath = path.join(tempDir, 'questions.md')
      fs.writeFileSync(filePath, 'TBD')
      expect(checkForQuestions(filePath)).toBe(false)
    })

    it('returns true for numbered questions', () => {
      const filePath = path.join(tempDir, 'questions.md')
      fs.writeFileSync(filePath, '1. What color is the sky?\n2. How tall is Everest?')
      expect(checkForQuestions(filePath)).toBe(true)
    })

    it('returns true for questions with ? mark', () => {
      const filePath = path.join(tempDir, 'questions.md')
      fs.writeFileSync(filePath, 'Should we use TypeScript?')
      expect(checkForQuestions(filePath)).toBe(true)
    })

    it('returns true for ## Questions header', () => {
      const filePath = path.join(tempDir, 'questions.md')
      fs.writeFileSync(filePath, '## Questions\n\n- Question 1?')
      expect(checkForQuestions(filePath)).toBe(true)
    })

    it('returns false for ## APPROVED', () => {
      const filePath = path.join(tempDir, 'questions.md')
      fs.writeFileSync(filePath, '## APPROVED\n\nThe plan looks good.')
      expect(checkForQuestions(filePath)).toBe(false)
    })

    it('returns false for "no clarifications needed"', () => {
      const filePath = path.join(tempDir, 'questions.md')
      fs.writeFileSync(filePath, 'No clarifications needed.')
      expect(checkForQuestions(filePath)).toBe(false)
    })
  })

  // ========================================================================
  // validateSpecContent
  // ========================================================================

  describe('validateSpecContent', () => {
    it('returns true for spec with Requirements section', () => {
      expect(validateSpecContent('# Spec\n\n## Requirements\n\n- Item 1')).toBe(true)
    })

    it('returns true for spec with Functional Requirements', () => {
      expect(validateSpecContent('# Spec\n\n## Functional Requirements\n\n- Item 1')).toBe(true)
    })

    it('returns true for spec with FR- prefix', () => {
      expect(validateSpecContent('# Spec\n\n## FR-001\n\n- Item 1')).toBe(true)
    })

    it('returns true for spec with Acceptance Criteria', () => {
      expect(validateSpecContent('# Spec\n\n## Acceptance Criteria\n\n- Item 1')).toBe(true)
    })

    it('returns false for spec without requirements or acceptance', () => {
      expect(validateSpecContent('# Spec\n\nJust some text.')).toBe(false)
    })
  })

  describe('validateSpecFile', () => {
    it('throws for missing file', () => {
      expect(() => validateSpecFile(path.join(tempDir, 'missing.md'))).toThrow('not found')
    })

    it('throws for invalid spec', () => {
      const filePath = path.join(tempDir, 'spec.md')
      fs.writeFileSync(filePath, '# Spec\n\nNo requirements here.')
      expect(() => validateSpecFile(filePath)).toThrow('missing')
    })

    it('succeeds for valid spec', () => {
      const filePath = path.join(tempDir, 'spec.md')
      fs.writeFileSync(filePath, '# Spec\n\n## Requirements\n\n- Item 1')
      expect(() => validateSpecFile(filePath)).not.toThrow()
    })
  })

  // ========================================================================
  // validateBuildReport
  // ========================================================================

  describe('validateBuildReport', () => {
    it('returns true for build with ## Changes', () => {
      expect(validateBuildReport('# Build\n\n## Changes\n\n- Added file.ts')).toBe(true)
    })

    it('returns true for build with ## Files', () => {
      expect(validateBuildReport('# Build\n\n## Files\n\n- file.ts')).toBe(true)
    })

    it('returns false for build without Changes/Files', () => {
      expect(validateBuildReport('# Build\n\nJust some text.')).toBe(false)
    })
  })

  describe('validateBuildFile', () => {
    it('returns empty string for valid build', () => {
      const filePath = path.join(tempDir, 'build.md')
      fs.writeFileSync(filePath, '# Build\n\n## Changes\n\n- Item')
      expect(validateBuildFile(filePath)).toBe('')
    })

    it('returns warning for missing Changes section', () => {
      const filePath = path.join(tempDir, 'build.md')
      fs.writeFileSync(filePath, '# Build\n\nNo changes.')
      expect(validateBuildFile(filePath)).toContain('missing')
    })

    it('returns empty string for missing file', () => {
      expect(validateBuildFile(path.join(tempDir, 'missing.md'))).toBe('')
    })
  })

  // ========================================================================
  // isPlanReviewFail
  // ========================================================================

  describe('isPlanReviewFail', () => {
    it('returns true for FAIL verdict', () => {
      expect(isPlanReviewFail('# Plan Review\n\nVerdict: FAIL')).toBe(true)
    })

    it('returns true for fail (lowercase)', () => {
      expect(isPlanReviewFail('# Plan Review\n\nVerdict: fail')).toBe(true)
    })

    it('returns false for PASS verdict', () => {
      expect(isPlanReviewFail('# Plan Review\n\nVerdict: PASS')).toBe(false)
    })

    it('returns false for no verdict', () => {
      expect(isPlanReviewFail('# Plan Review\n\nSome content')).toBe(false)
    })
  })

  describe('validatePlanReviewVerdict', () => {
    it('throws for missing file', () => {
      expect(() => validatePlanReviewVerdict(path.join(tempDir, 'missing.md'))).toThrow('not found')
    })

    it('returns false for FAIL verdict', () => {
      const filePath = path.join(tempDir, 'plan-review.md')
      fs.writeFileSync(filePath, '# Plan Review\n\nVerdict: FAIL')
      expect(validatePlanReviewVerdict(filePath)).toBe(false)
    })

    it('returns true for PASS verdict', () => {
      const filePath = path.join(tempDir, 'plan-review.md')
      fs.writeFileSync(filePath, '# Plan Review\n\nVerdict: PASS')
      expect(validatePlanReviewVerdict(filePath)).toBe(true)
    })
  })

  // ========================================================================
  // extractVerifySummary
  // ========================================================================

  describe('extractVerifySummary', () => {
    it('extracts TypeScript error count', () => {
      const content = 'TypeScript: 5 errors found'
      const summary = extractVerifySummary(content)
      expect(summary.typeScriptErrors).toBe(5)
    })

    it('extracts test failure count', () => {
      const content = 'Tests: 3 failures'
      const summary = extractVerifySummary(content)
      expect(summary.testFailures).toBe(3)
    })

    it('extracts lint error count', () => {
      const content = 'Lint: 2 errors'
      const summary = extractVerifySummary(content)
      expect(summary.lintErrors).toBe(2)
    })

    it('extracts error samples', () => {
      const content = '# Verify\n\n- error TS2307: File not found\n- Error: Something went wrong'
      const summary = extractVerifySummary(content)
      expect(summary.errorSamples.length).toBeGreaterThan(0)
    })

    it('returns zero counts when no errors', () => {
      const summary = extractVerifySummary('# Verify\n\nAll checks passed!')
      expect(summary.typeScriptErrors).toBe(0)
      expect(summary.testFailures).toBe(0)
      expect(summary.lintErrors).toBe(0)
    })
  })

  // ========================================================================
  // isVerifyFailed
  // ========================================================================

  describe('isVerifyFailed', () => {
    it('returns true for FAIL content', () => {
      expect(isVerifyFailed('Result: FAIL')).toBe(true)
    })

    it('returns false for PASS content', () => {
      expect(isVerifyFailed('Result: PASS')).toBe(false)
    })
  })
})

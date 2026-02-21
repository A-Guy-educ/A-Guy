/**
 * @fileType test
 * @domain ci | cody
 * @pattern stage-hooks
 * @ai-summary Tests for stage-hooks.ts - post-stage hook functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  PlanReviewFailError,
  handleRerunFeedbackArchive,
  handlePlanReviewGate,
  handleBuildValidation,
  handlePostBuildTsc,
  handleVerifyResult,
} from '../../../../scripts/cody/stage-hooks'

describe('stage-hooks', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-hooks-'))
    // Create .tasks structure
    fs.mkdirSync(path.join(tempDir, '.tasks', '260218-test'), { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  // ========================================================================
  // handleRerunFeedbackArchive
  // ========================================================================

  describe('handleRerunFeedbackArchive', () => {
    it('does nothing when rerun-feedback.md does not exist', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      expect(() => handleRerunFeedbackArchive(opts)).not.toThrow()
      expect(fs.existsSync(path.join(taskDir, 'rerun-feedback.consumed.md'))).toBe(false)
    })

    it('renames rerun-feedback.md to consumed when exists', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      fs.writeFileSync(path.join(taskDir, 'rerun-feedback.md'), 'Feedback content')

      handleRerunFeedbackArchive(opts)

      expect(fs.existsSync(path.join(taskDir, 'rerun-feedback.md'))).toBe(false)
      expect(fs.existsSync(path.join(taskDir, 'rerun-feedback.consumed.md'))).toBe(true)
    })
  })

  // ========================================================================
  // handlePlanReviewGate
  // ========================================================================

  describe('handlePlanReviewGate', () => {
    it('does nothing when plan-review.md does not exist', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      expect(() => handlePlanReviewGate(opts)).not.toThrow()
    })

    it('does nothing when verdict is PASS', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      fs.writeFileSync(path.join(taskDir, 'plan-review.md'), '# Plan Review\n\nVerdict: PASS')
      expect(() => handlePlanReviewGate(opts)).not.toThrow()
    })

    it('throws PlanReviewFailError when verdict is FAIL', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      fs.writeFileSync(path.join(taskDir, 'plan-review.md'), '# Plan Review\n\nVerdict: FAIL')
      fs.writeFileSync(path.join(taskDir, 'plan.md'), '# Plan\n\nSome plan')
      expect(() => handlePlanReviewGate(opts)).toThrow(PlanReviewFailError)
    })

    it('renames plan-review.md to plan-review.rejected.md and deletes plan.md on FAIL', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      fs.writeFileSync(
        path.join(taskDir, 'plan-review.md'),
        '# Plan Review\n\nVerdict: FAIL\n\nSome blocking issues',
      )
      fs.writeFileSync(path.join(taskDir, 'plan.md'), '# Plan')

      try {
        handlePlanReviewGate(opts)
      } catch {
        // Expected
      }

      // plan-review.md should be renamed to plan-review.rejected.md (not deleted)
      expect(fs.existsSync(path.join(taskDir, 'plan-review.md'))).toBe(false)
      expect(fs.existsSync(path.join(taskDir, 'plan-review.rejected.md'))).toBe(true)
      // plan.md should be deleted so architect re-runs
      expect(fs.existsSync(path.join(taskDir, 'plan.md'))).toBe(false)
    })

    it('warns when no verdict line is found', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      // Write content without Verdict line
      fs.writeFileSync(path.join(taskDir, 'plan-review.md'), '# Plan Review\n\nSome review content')

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      handlePlanReviewGate(opts)

      expect(warnSpy).toHaveBeenCalledWith(
        '  ⚠️  Warning: No Verdict line found in plan-review.md — treating as PASS',
      )
      warnSpy.mockRestore()
    })
  })

  // ========================================================================
  // handleBuildValidation
  // ========================================================================

  describe('handleBuildValidation', () => {
    it('does nothing when build.md does not exist', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      expect(() => handleBuildValidation(opts)).not.toThrow()
    })

    it('throws error when build.md missing Changes section', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      fs.writeFileSync(path.join(taskDir, 'build.md'), '# Build\n\nNo changes here.')
      expect(() => handleBuildValidation(opts)).toThrow(
        'Build report missing Changes section — agent may not have implemented anything',
      )
    })

    it('does not warn when build.md has Changes section', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      fs.writeFileSync(path.join(taskDir, 'build.md'), '# Build\n\n## Changes\n\n- Added file')
      expect(() => handleBuildValidation(opts)).not.toThrow()
    })
  })

  // ========================================================================
  // handleVerifyResult
  // ========================================================================

  describe('handleVerifyResult', () => {
    it('returns failed: false when verify.md does not exist', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      const result = handleVerifyResult(opts)
      expect(result.failed).toBe(false)
    })

    it('returns failed: false when verify content is PASS', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      fs.writeFileSync(path.join(taskDir, 'verify.md'), '# Verify\n\nResult: PASS')
      const result = handleVerifyResult(opts)
      expect(result.failed).toBe(false)
    })

    it('returns failed: true with summary when verify content is FAIL', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      fs.writeFileSync(
        path.join(taskDir, 'verify.md'),
        '# Verify\n\nResult: FAIL\n\nTypeScript: 5 errors\nTests: 2 failures',
      )
      const result = handleVerifyResult(opts)
      expect(result.failed).toBe(true)
      expect(result.summary).toBeDefined()
      expect(result.summary?.typeScriptErrors).toBe(5)
      expect(result.summary?.testFailures).toBe(2)
    })
  })

  // ========================================================================
  // PlanReviewFailError
  // ========================================================================

  describe('PlanReviewFailError', () => {
    it('has correct name and message', () => {
      const error = new PlanReviewFailError()
      expect(error.name).toBe('PlanReviewFailError')
      expect(error.message).toBe('Plan review verdict: FAIL')
    })

    it('is instanceof Error', () => {
      const error = new PlanReviewFailError()
      expect(error).toBeInstanceOf(Error)
    })
  })
})

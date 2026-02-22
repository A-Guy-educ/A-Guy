/**
 * @fileType test
 * @domain ci | cody
 * @pattern stage-hooks
 * @ai-summary Tests for stage-hooks.ts - post-stage hook functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  handleRerunFeedbackArchive,
  handlePlanGapValidation,
  handleBuildValidation,
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
  // handlePlanGapValidation
  // ========================================================================

  describe('handlePlanGapValidation', () => {
    it('does nothing when plan-gap.md does not exist', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      expect(() => handlePlanGapValidation(opts)).not.toThrow()
    })

    it('succeeds when plan-gap.md has valid gap report (## Gaps Found)', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      fs.writeFileSync(
        path.join(taskDir, 'plan-gap.md'),
        '# Plan Gap Analysis\n\n## Gaps Found\n\n- Gap 1: Missing step',
      )
      fs.writeFileSync(path.join(taskDir, 'plan.md'), '# Plan\n\nSome plan')
      expect(() => handlePlanGapValidation(opts)).not.toThrow()
    })

    it('succeeds when plan-gap.md has ## Changes Made', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      fs.writeFileSync(
        path.join(taskDir, 'plan-gap.md'),
        '# Plan Gap Analysis\n\n## Changes Made\n\n- Added Step 1',
      )
      fs.writeFileSync(path.join(taskDir, 'plan.md'), '# Plan')
      expect(() => handlePlanGapValidation(opts)).not.toThrow()
    })

    it('succeeds when plan-gap.md says "No gaps identified"', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      fs.writeFileSync(
        path.join(taskDir, 'plan-gap.md'),
        '# Plan Gap Analysis\n\nNo gaps identified.',
      )
      fs.writeFileSync(path.join(taskDir, 'plan.md'), '# Plan')
      expect(() => handlePlanGapValidation(opts)).not.toThrow()
    })

    it('throws when plan-gap.md is invalid (empty/missing sections)', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      fs.writeFileSync(path.join(taskDir, 'plan-gap.md'), 'Invalid content')
      expect(() => handlePlanGapValidation(opts)).toThrow(
        'Plan gap report is invalid — must contain ## Gaps Found, ## Changes Made, or "No gaps identified"',
      )
    })

    it('throws when plan.md is missing after gap agent ran', () => {
      const taskDir = path.join(tempDir, '.tasks', '260218-test')
      const opts = { taskId: '260218-test', taskDir, dryRun: false, isCI: false }
      fs.writeFileSync(
        path.join(taskDir, 'plan-gap.md'),
        '# Plan Gap Analysis\n\nNo gaps identified.',
      )
      // No plan.md
      expect(() => handlePlanGapValidation(opts)).toThrow(
        'plan.md missing after plan-gap agent ran — agent may have deleted it',
      )
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
})

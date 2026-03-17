/**
 * @fileType test
 * @domain cody
 * @ai-summary Tests for parse-inputs.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isValidTaskId,
  normalizeComment,
  extractCommandAfterCody,
  parseDispatchInputs,
  parseCommentInputs,
  getDefaultOutputs,
} from '../../../../scripts/cody/parse-inputs'

// Mock child_process.execSync
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}))

import { execFileSync } from 'child_process'

describe('parse-inputs', () => {
  describe('isValidTaskId', () => {
    it('should validate correct task IDs', () => {
      expect(isValidTaskId('260225-auto-90')).toBe(true)
      expect(isValidTaskId('260225-fix-bug')).toBe(true)
      expect(isValidTaskId('260225-a')).toBe(true)
    })

    it('should reject invalid task IDs', () => {
      expect(isValidTaskId('')).toBe(false)
      expect(isValidTaskId('TEST')).toBe(false)
      expect(isValidTaskId('260225')).toBe(false)
      expect(isValidTaskId('-abc')).toBe(false)
      expect(isValidTaskId('1234567-too-long')).toBe(false)
    })
  })

  describe('normalizeComment', () => {
    it('should lowercase and trim', () => {
      expect(normalizeComment('  @CODY  ')).toBe('@cody')
      expect(normalizeComment('/CODY FULL')).toBe('/cody full')
      expect(normalizeComment('@cody Impl')).toBe('@cody impl')
    })

    it('should handle empty strings', () => {
      expect(normalizeComment('')).toBe('')
      expect(normalizeComment('   ')).toBe('')
    })
  })

  describe('extractCommandAfterCody', () => {
    it('should extract command after @cody', () => {
      expect(extractCommandAfterCody('@cody')).toBe('')
      expect(extractCommandAfterCody('@cody full')).toBe('full')
      expect(extractCommandAfterCody('@cody impl')).toBe('impl')
      expect(extractCommandAfterCody('@cody  ')).toBe('')
      expect(extractCommandAfterCody('@cody   spec ')).toBe('spec')
    })

    it('should extract command after /cody', () => {
      expect(extractCommandAfterCody('/cody')).toBe('')
      expect(extractCommandAfterCody('/cody full')).toBe('full')
      expect(extractCommandAfterCody('/cody impl')).toBe('impl')
    })

    it('should handle case insensitivity', () => {
      expect(extractCommandAfterCody('@CODY FULL')).toBe('full')
      expect(extractCommandAfterCody('/CODY impl')).toBe('impl')
    })

    it('should handle approval keywords', () => {
      expect(extractCommandAfterCody('@cody approve')).toBe('approve')
      expect(extractCommandAfterCody('@cody yes')).toBe('yes')
      expect(extractCommandAfterCody('@cody go')).toBe('go')
    })

    it('should return empty for non-cody comments', () => {
      expect(extractCommandAfterCody('hello')).toBe('')
      expect(extractCommandAfterCody('run @cody')).toBe('')
    })

    // BUG-Fix: Multiline comments should extract content after @cody
    // Previously the regex didn't match newlines, causing mode to default to 'full'
    it('should extract command from multiline comments', () => {
      expect(extractCommandAfterCody('@cody approve\n1. yes\n2. no')).toBe('approve\n1. yes\n2. no')
      // Note: normalizeComment lowercases the input, so we test with lowercase
      expect(extractCommandAfterCody('/cody yes\nuse mongodb')).toBe('yes\nuse mongodb')
      expect(extractCommandAfterCody('@cody proceed\nline 1\nline 2')).toBe(
        'proceed\nline 1\nline 2',
      )
    })
  })

  describe('getDefaultOutputs', () => {
    it('should return default values', () => {
      const defaults = getDefaultOutputs()

      expect(defaults.task_id).toBe('')
      expect(defaults.mode).toBe('full')
      expect(defaults.clarify).toBe('false')
      expect(defaults.dry_run).toBe('false')
      expect(defaults.from_stage).toBe('')
      expect(defaults.feedback).toBe('')
      expect(defaults.issue_number).toBe('')
      expect(defaults.trigger_type).toBe('')
      expect(defaults.comment_body).toBe('')
      expect(defaults.valid).toBe('false')
    })
  })

  describe('parseDispatchInputs', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      // Set up required env vars for dispatch mode
      vi.stubEnv('GITHUB_EVENT_NAME', 'workflow_dispatch')
      vi.stubEnv('GITHUB_OUTPUT', '/tmp/test-output')
      // Clear all dispatch env vars
      vi.unstubAllEnvs()
      vi.stubEnv('GITHUB_EVENT_NAME', 'workflow_dispatch')
      vi.stubEnv('GITHUB_OUTPUT', '/tmp/test-output')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('should parse valid dispatch inputs', () => {
      vi.stubEnv('DISPATCH_TASK_ID', '260225-test')
      vi.stubEnv('DISPATCH_MODE', 'impl')
      vi.stubEnv('DISPATCH_CLARIFY', 'true')
      vi.stubEnv('DISPATCH_DRY_RUN', 'false')

      const result = parseDispatchInputs()

      expect(result.task_id).toBe('260225-test')
      expect(result.mode).toBe('impl')
      expect(result.clarify).toBe('true')
      expect(result.dry_run).toBe('false')
      expect(result.trigger_type).toBe('dispatch')
      expect(result.valid).toBe('true')
    })

    it('should use defaults for missing optional fields', () => {
      vi.stubEnv('DISPATCH_TASK_ID', '260225-test')

      const result = parseDispatchInputs()

      expect(result.mode).toBe('full')
      expect(result.clarify).toBe('false')
      expect(result.dry_run).toBe('false')
    })

    it('should reject empty task_id', () => {
      vi.stubEnv('DISPATCH_TASK_ID', '')

      const result = parseDispatchInputs()

      expect(result.valid).toBe('false')
      expect(result.task_id).toBe('')
    })

    it('should reject invalid task_id format', () => {
      vi.stubEnv('DISPATCH_TASK_ID', 'TEST')

      const result = parseDispatchInputs()

      expect(result.valid).toBe('false')
      expect(result.task_id).toBe('')
    })
  })

  describe('parseCommentInputs', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      vi.unstubAllEnvs()
      vi.stubEnv('GITHUB_EVENT_NAME', 'issue_comment')
      vi.stubEnv('GITHUB_OUTPUT', '/tmp/test-output')
      vi.stubEnv('SAFETY_VALID', 'true')
      vi.stubEnv('ISSUE_NUMBER', '')
      vi.stubEnv('COMMENT_BODY', '')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('should default to full mode for @cody alone', () => {
      vi.stubEnv('COMMENT_BODY', '@cody')

      const result = parseCommentInputs()

      expect(result.mode).toBe('full')
      expect(result.valid).toBe('true')
    })

    it('should parse explicit mode', () => {
      vi.stubEnv('COMMENT_BODY', '@cody spec')

      const result = parseCommentInputs()

      expect(result.mode).toBe('spec')
      expect(result.valid).toBe('true')
    })

    it('should parse all valid modes', () => {
      const modes = ['spec', 'impl', 'rerun', 'full', 'status']

      for (const mode of modes) {
        vi.stubEnv('COMMENT_BODY', `@cody ${mode}`)
        const result = parseCommentInputs()
        expect(result.mode).toBe(mode)
      }
    })

    it('should default to full for unknown commands', () => {
      vi.stubEnv('COMMENT_BODY', '@cody some-description')

      const result = parseCommentInputs()

      expect(result.mode).toBe('full')
      expect(result.valid).toBe('true')
    })

    it('should set rerun mode for approval keywords', () => {
      const approvalKeywords = ['approve', 'approved', 'yes', 'go', 'proceed', 'y', 'continue']

      for (const keyword of approvalKeywords) {
        vi.stubEnv('COMMENT_BODY', `@cody ${keyword}`)
        const result = parseCommentInputs()
        expect(result.mode).toBe('rerun')
      }
    })

    // BUG-Fix: Approval keywords with appended answers should still resolve to rerun mode
    // Previously exact match failed: "approve yes use TS" not in APPROVAL_KEYWORDS
    it('should set rerun mode for approval keyword + single-line answer', () => {
      const cases = [
        ['@cody approve use TypeScript', 'rerun'],
        ['@cody approve yes use MongoDB', 'rerun'],
        ['@cody yes use TypeScript', 'rerun'],
        ['@cody yes use MongoDB', 'rerun'],
        ['@cody proceed with the plan', 'rerun'],
        ['@cody go ahead with implementation', 'rerun'],
        ['/cody approve the changes', 'rerun'],
        ['/cody yes use PostgreSQL', 'rerun'],
      ]

      for (const [comment, expectedMode] of cases) {
        vi.stubEnv('COMMENT_BODY', comment)
        const result = parseCommentInputs()
        expect(result.mode).toBe(expectedMode)
      }
    })

    // BUG-Fix: Multiline approval commands with answers should resolve to rerun mode
    it('should set rerun mode for approval keyword + multiline answer', () => {
      const multilineCases = [
        ['@cody approve\n1. yes\n2. no', 'rerun'],
        ['@cody yes\nuse MongoDB', 'rerun'],
        ['@cody proceed\nThe implementation is ready', 'rerun'],
      ]

      for (const [comment, expectedMode] of multilineCases) {
        vi.stubEnv('COMMENT_BODY', comment)
        const result = parseCommentInputs()
        expect(result.mode).toBe(expectedMode)
      }
    })

    // Verify comment_body is still passed through correctly for answer extraction
    it('should preserve comment_body for gate approval detection', () => {
      vi.stubEnv('COMMENT_BODY', '@cody approve this is my answer')
      const result = parseCommentInputs()
      // comment_body is JSON.stringify'd
      expect(result.comment_body).toContain('approve this is my answer')
    })

    it('should reject when safety check fails', () => {
      vi.stubEnv('SAFETY_VALID', 'false')
      vi.stubEnv('SAFETY_REASON', 'unauthorized')
      vi.stubEnv('COMMENT_BODY', '@cody full')

      const result = parseCommentInputs()

      expect(result.valid).toBe('false')
    })

    it('should validate discovered task-id format', () => {
      vi.stubEnv('COMMENT_BODY', '@cody full')
      vi.stubEnv('ISSUE_NUMBER', '123')

      // Mock gh to return a valid task-id
      vi.mocked(execFileSync).mockReturnValue('Task created: `260225-test`')

      const result = parseCommentInputs()

      expect(result.task_id).toBe('260225-test')
      expect(result.valid).toBe('true')
    })

    it('should discover valid task-id from issue comments', () => {
      vi.stubEnv('COMMENT_BODY', '@cody full')
      vi.stubEnv('ISSUE_NUMBER', '123')

      // Mock gh to return a valid task-id
      vi.mocked(execFileSync).mockReturnValue('Task created: `260225-test`')

      const result = parseCommentInputs()

      expect(result.task_id).toBe('260225-test')
      expect(result.valid).toBe('true')
    })

    // BUG-Fix: /cody rerun --from=build should parse --from flag and set rerun mode
    it('should parse --from=stage flag with equals syntax', () => {
      vi.stubEnv('COMMENT_BODY', '/cody rerun --from=build')

      const result = parseCommentInputs()

      expect(result.mode).toBe('rerun')
      expect(result.from_stage).toBe('build')
    })

    it('should parse --from stage flag with space syntax', () => {
      vi.stubEnv('COMMENT_BODY', '/cody rerun --from build')

      const result = parseCommentInputs()

      expect(result.mode).toBe('rerun')
      expect(result.from_stage).toBe('build')
    })

    it('should parse --from with verify stage', () => {
      vi.stubEnv('COMMENT_BODY', '@cody rerun --from=verify')

      const result = parseCommentInputs()

      expect(result.mode).toBe('rerun')
      expect(result.from_stage).toBe('verify')
    })

    it('should parse --feedback flag', () => {
      vi.stubEnv('COMMENT_BODY', '/cody rerun --feedback fix-tests')

      const result = parseCommentInputs()

      expect(result.mode).toBe('rerun')
      expect(result.feedback).toBe('fix-tests')
    })

    it('should parse both --from and --feedback flags together', () => {
      vi.stubEnv('COMMENT_BODY', '/cody rerun --from=build --feedback fix-tests')

      const result = parseCommentInputs()

      expect(result.mode).toBe('rerun')
      expect(result.from_stage).toBe('build')
      expect(result.feedback).toBe('fix-tests')
    })

    it('should parse rerun mode even with extra args after it', () => {
      vi.stubEnv('COMMENT_BODY', '/cody rerun 260218-task --from build')
      vi.stubEnv('ISSUE_NUMBER', '')

      const result = parseCommentInputs()

      // rerun is detected as first word mode
      expect(result.mode).toBe('rerun')
      expect(result.from_stage).toBe('build')
    })

    it('should not set from_stage when --from flag is absent', () => {
      vi.stubEnv('COMMENT_BODY', '/cody rerun')

      const result = parseCommentInputs()

      expect(result.mode).toBe('rerun')
      expect(result.from_stage).toBe('')
    })
  })
})

describe('is_pull_request in getDefaultOutputs', () => {
  it('should default to empty when IS_PULL_REQUEST is not set', () => {
    // Save original env
    const original = process.env.IS_PULL_REQUEST

    // Clear the env var
    delete process.env.IS_PULL_REQUEST

    const outputs = getDefaultOutputs()
    expect(outputs.is_pull_request).toBe('')

    // Restore
    if (original !== undefined) {
      process.env.IS_PULL_REQUEST = original
    }
  })

  it('should be true when IS_PULL_REQUEST is "true"', () => {
    const original = process.env.IS_PULL_REQUEST
    process.env.IS_PULL_REQUEST = 'true'

    const outputs = getDefaultOutputs()
    expect(outputs.is_pull_request).toBe('true')

    if (original !== undefined) {
      process.env.IS_PULL_REQUEST = original
    } else {
      delete process.env.IS_PULL_REQUEST
    }
  })
})

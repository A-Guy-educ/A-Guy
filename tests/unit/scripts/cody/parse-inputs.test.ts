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
}))

import { execSync } from 'child_process'

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
      vi.mocked(execSync).mockReturnValue('Task created: `260225-test`')

      const result = parseCommentInputs()

      expect(result.task_id).toBe('260225-test')
      expect(result.valid).toBe('true')
    })

    it('should discover valid task-id from issue comments', () => {
      vi.stubEnv('COMMENT_BODY', '@cody full')
      vi.stubEnv('ISSUE_NUMBER', '123')

      // Mock gh to return a valid task-id
      vi.mocked(execSync).mockReturnValue('Task created: `260225-test`')

      const result = parseCommentInputs()

      expect(result.task_id).toBe('260225-test')
      expect(result.valid).toBe('true')
    })
  })
})

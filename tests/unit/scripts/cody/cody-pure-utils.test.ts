/**
 * @fileType test
 * @domain cody | utils
 * @pattern unit-test
 * @ai-summary Unit tests for pure utility functions from Cody pipeline modules
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// Import directly from the source files
import { parseCommentBody, parseCliArgs } from '../../../../scripts/cody/cli-parser'
import { formatDuration, formatStatusComment } from '../../../../scripts/cody/status-format'
import { isValidMode, isValidStage, validateTaskId } from '../../../../scripts/cody/validation'
import { isValidStageName, STAGE_NAMES } from '../../../../scripts/cody/stages/registry'
import type { CodyInput, CodyPipelineStatus } from '../../../../scripts/cody/cody-utils'

describe('parseCommentBody', () => {
  describe('mode parsing', () => {
    it('should parse /cody impl as mode impl', () => {
      const result = parseCommentBody('/cody impl')
      expect(result.success).toBe(true)
      expect(result.input?.mode).toBe('impl')
    })

    it('should parse /cody spec as mode spec', () => {
      const result = parseCommentBody('/cody spec')
      expect(result.success).toBe(true)
      expect(result.input?.mode).toBe('spec')
    })

    it('should parse /cody rerun as mode rerun', () => {
      const result = parseCommentBody('/cody rerun')
      expect(result.success).toBe(true)
      expect(result.input?.mode).toBe('rerun')
    })

    it('should parse /cody full as mode full', () => {
      const result = parseCommentBody('/cody full')
      expect(result.success).toBe(true)
      expect(result.input?.mode).toBe('full')
    })

    it('should parse /cody fix as mode fix', () => {
      const result = parseCommentBody('/cody fix')
      expect(result.success).toBe(true)
      expect(result.input?.mode).toBe('fix')
    })

    it('should parse /cody status as mode status', () => {
      const result = parseCommentBody('/cody status')
      expect(result.success).toBe(true)
      expect(result.input?.mode).toBe('status')
    })

    it('should default to full mode for /cody with no subcommand', () => {
      const result = parseCommentBody('/cody')
      expect(result.success).toBe(true)
      expect(result.input?.mode).toBe('full')
    })
  })

  describe('dry-run parsing', () => {
    it('should parse --dry-run flag', () => {
      const result = parseCommentBody('/cody impl --dry-run')
      expect(result.success).toBe(true)
      expect(result.input?.dryRun).toBe(true)
    })
  })

  describe('task-id parsing', () => {
    it('should parse task-id after mode', () => {
      const result = parseCommentBody('/cody impl 260218-user-metrics')
      expect(result.success).toBe(true)
      expect(result.input?.taskId).toBe('260218-user-metrics')
    })

    it('should parse task-id as implicit mode (no subcommand)', () => {
      const result = parseCommentBody('/cody 260218-user-metrics')
      expect(result.success).toBe(true)
      expect(result.input?.mode).toBe('full')
      expect(result.input?.taskId).toBe('260218-user-metrics')
    })

    it('should return empty taskId for invalid format', () => {
      const result = parseCommentBody('/cody impl invalid-task')
      expect(result.success).toBe(true)
      expect(result.input?.taskId).toBe('')
    })
  })

  describe('fromStage parsing', () => {
    it('should parse --from flag with valid stage', () => {
      const result = parseCommentBody('/cody impl --from build')
      expect(result.success).toBe(true)
      expect(result.input?.fromStage).toBe('build')
    })

    it('should parse --from with task-id', () => {
      const result = parseCommentBody('/cody impl 260218-test --from build')
      expect(result.success).toBe(true)
      expect(result.input?.fromStage).toBe('build')
      expect(result.input?.taskId).toBe('260218-test')
    })
  })

  describe('feedback parsing', () => {
    it('should parse --feedback flag', () => {
      const result = parseCommentBody('/cody rerun --feedback fix the tests')
      expect(result.success).toBe(true)
      expect(result.input?.feedback).toBe('fix the tests')
    })

    it('should parse implicit feedback for rerun mode', () => {
      const result = parseCommentBody('/cody rerun adjust the styling')
      expect(result.success).toBe(true)
      expect(result.input?.feedback).toBe('adjust the styling')
    })
  })

  describe('control mode parsing', () => {
    it('should parse --auto flag', () => {
      const result = parseCommentBody('/cody impl --auto')
      expect(result.success).toBe(true)
      expect(result.input?.controlMode).toBe('auto')
    })

    it('should parse --gate flag', () => {
      const result = parseCommentBody('/cody impl --gate')
      expect(result.success).toBe(true)
      expect(result.input?.controlMode).toBe('risk-gated')
    })

    it('should parse --hard-stop flag', () => {
      const result = parseCommentBody('/cody impl --hard-stop')
      expect(result.success).toBe(true)
      expect(result.input?.controlMode).toBe('hard-stop')
    })
  })

  describe('fresh flag parsing', () => {
    it('should parse --fresh flag', () => {
      const result = parseCommentBody('/cody impl --fresh')
      expect(result.success).toBe(true)
      expect(result.input?.fresh).toBe(true)
    })
  })

  describe('issue number', () => {
    it('should accept issue number parameter', () => {
      const result = parseCommentBody('/cody impl', 123)
      expect(result.success).toBe(true)
      expect(result.input?.issueNumber).toBe(123)
    })
  })

  describe('trigger type', () => {
    it('should set triggerType to comment', () => {
      const result = parseCommentBody('/cody impl')
      expect(result.success).toBe(true)
      expect(result.input?.triggerType).toBe('comment')
    })
  })

  describe('error handling', () => {
    it('should return error for invalid stage in --from', () => {
      const result = parseCommentBody('/cody impl --from invalid-stage')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid stage')
    })
  })
})

describe('isValidMode', () => {
  it('should return true for valid modes', () => {
    expect(isValidMode('spec')).toBe(true)
    expect(isValidMode('impl')).toBe(true)
    expect(isValidMode('rerun')).toBe(true)
    expect(isValidMode('fix')).toBe(true)
    expect(isValidMode('full')).toBe(true)
    expect(isValidMode('status')).toBe(true)
  })

  it('should return false for invalid modes', () => {
    expect(isValidMode('invalid')).toBe(false)
    expect(isValidMode('')).toBe(false)
    expect(isValidMode('build')).toBe(false)
    expect(isValidMode('SPEC')).toBe(false) // case sensitive
    expect(isValidMode('specx')).toBe(false)
  })
})

describe('isValidStage', () => {
  it('should return true for all STAGE_NAMES', () => {
    STAGE_NAMES.forEach((stage) => {
      expect(isValidStage(stage)).toBe(true)
    })
  })

  it('should return true for autofix (backward compat)', () => {
    expect(isValidStage('autofix')).toBe(true)
  })

  it('should return false for invalid stages', () => {
    expect(isValidStage('spec')).toBe(false) // spec is a mode, not a stage
    expect(isValidStage('autofixx')).toBe(false)
    expect(isValidStage('')).toBe(false)
    expect(isValidStage('invalid')).toBe(false)
    expect(isValidStage('SPEC')).toBe(false) // case sensitive
  })
})

describe('isValidStageName', () => {
  it('should return true for all STAGE_NAMES', () => {
    STAGE_NAMES.forEach((stage) => {
      expect(isValidStageName(stage)).toBe(true)
    })
  })

  it('should return false for non-stage names', () => {
    expect(isValidStageName('spec')).toBe(false)
    expect(isValidStageName('impl')).toBe(false)
    expect(isValidStageName('invalid')).toBe(false)
    expect(isValidStageName('')).toBe(false)
  })
})

describe('validateTaskId', () => {
  it('should return true for valid task IDs', () => {
    expect(validateTaskId('260218-user-metrics')).toBe(true)
    expect(validateTaskId('260101-test')).toBe(true)
    expect(validateTaskId('260101-a')).toBe(true)
    expect(validateTaskId('260101-my-feature')).toBe(true)
  })

  it('should return false for invalid task IDs', () => {
    expect(validateTaskId('invalid')).toBe(false)
    expect(validateTaskId('')).toBe(false)
    expect(validateTaskId('12345-short')).toBe(false) // 5 digits - too few
    expect(validateTaskId('USER-METRICS')).toBe(false) // uppercase
  })
})

describe('formatDuration', () => {
  it('should format seconds only', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(500)).toBe('0s')
    expect(formatDuration(999)).toBe('0s')
    expect(formatDuration(1000)).toBe('1s')
    expect(formatDuration(1500)).toBe('1s')
    expect(formatDuration(59999)).toBe('59s')
  })

  it('should format minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1m 0s')
    expect(formatDuration(60001)).toBe('1m 0s')
    expect(formatDuration(61000)).toBe('1m 1s')
    expect(formatDuration(90000)).toBe('1m 30s')
    expect(formatDuration(3661000)).toBe('61m 1s')
  })

  it('should handle larger values', () => {
    expect(formatDuration(3600000)).toBe('60m 0s')
    expect(formatDuration(3661000)).toBe('61m 1s')
    expect(formatDuration(7200000)).toBe('120m 0s')
  })
})

describe('formatStatusComment', () => {
  const createBaseInput = (overrides?: Partial<CodyInput>): CodyInput => ({
    mode: 'full',
    taskId: '260218-test',
    dryRun: false,
    ...overrides,
  })

  const createBaseStatus = (overrides?: Partial<CodyPipelineStatus>): CodyPipelineStatus => ({
    taskId: '260218-test',
    mode: 'full',
    pipeline: 'spec_execute_verify',
    startedAt: '2026-02-18T10:00:00.000Z',
    updatedAt: '2026-02-18T10:00:00.000Z',
    state: 'running',
    currentStage: null,
    stages: {},
    triggeredBy: 'comment',
    ...overrides,
  })

  describe('running state', () => {
    it('should format running state with task ID and mode', () => {
      const input = createBaseInput()
      const status = createBaseStatus({ state: 'running' })

      const result = formatStatusComment(input, status)

      expect(result).toContain('🔄 Cody running for `260218-test`')
      expect(result).toContain('(mode: full)')
    })

    it('should include stage list when currentStage provided', () => {
      const input = createBaseInput()
      const status = createBaseStatus({
        state: 'running',
        currentStage: 'build',
        stages: {
          taskify: { state: 'completed', retries: 0, elapsed: 1000 },
          build: { state: 'running', retries: 0 },
        },
      })

      const result = formatStatusComment(input, status, 'build')

      expect(result).toContain('✅ taskify')
      expect(result).toContain('🔄 build')
    })
  })

  describe('completed state', () => {
    it('should format completed state', () => {
      const input = createBaseInput({ mode: 'impl' })
      const status = createBaseStatus({
        state: 'completed',
        stages: {
          taskify: { state: 'completed', retries: 0, elapsed: 5000 },
        },
      })

      const result = formatStatusComment(input, status)

      expect(result).toContain('✅ Cody completed for `260218-test`!')
      expect(result).toContain('Mode: impl')
    })

    it('should include stage timing', () => {
      const input = createBaseInput()
      const status = createBaseStatus({
        state: 'completed',
        stages: {
          taskify: { state: 'completed', retries: 0, elapsed: 5000 },
          build: { state: 'completed', retries: 0, elapsed: 30000 },
        },
      })

      const result = formatStatusComment(input, status)

      expect(result).toContain('taskify')
      expect(result).toContain('5s')
      expect(result).toContain('30s')
    })

    it('should include cost data when available', () => {
      const input = createBaseInput()
      const status = createBaseStatus({
        state: 'completed',
        totalCost: 0.1234,
        stages: {
          taskify: { state: 'completed', retries: 0, cost: 0.05 },
        },
      })

      const result = formatStatusComment(input, status)

      expect(result).toContain('| Stage | Status | Duration | Cost |')
      expect(result).toContain('$0.0500')
      expect(result).toContain('$0.1234')
    })
  })

  describe('paused state', () => {
    it('should format paused state with approval instructions', () => {
      const input = createBaseInput()
      const status = createBaseStatus({ state: 'paused' })

      const result = formatStatusComment(input, status)

      expect(result).toContain('⏸️ Cody paused for `260218-test`')
      expect(result).toContain('@cody approve')
    })
  })

  describe('failed state', () => {
    it('should format failed state', () => {
      const input = createBaseInput()
      const status = createBaseStatus({ state: 'failed' })

      const result = formatStatusComment(input, status)

      expect(result).toContain('❌ Cody failed for `260218-test`')
    })
  })

  describe('timeout state', () => {
    it('should format timeout state', () => {
      const input = createBaseInput()
      const status = createBaseStatus({ state: 'timeout' })

      const result = formatStatusComment(input, status)

      expect(result).toContain('⏰ Cody timed out for `260218-test`')
    })
  })

  describe('run URL', () => {
    it('should append run URL when provided', () => {
      const input = createBaseInput({ runUrl: 'https://github.com/org/repo/actions/runs/123' })
      const status = createBaseStatus({ state: 'running' })

      const result = formatStatusComment(input, status)

      expect(result).toContain('Run: https://github.com/org/repo/actions/runs/123')
    })
  })
})

describe('parseCliArgs - basic parsing', () => {
  // Store original env to restore after tests
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.TASK_ID
    delete process.env.MODE
    delete process.env.DRY_RUN
    delete process.env.FEEDBACK
    delete process.env.FROM_STAGE
    delete process.env.CLARIFY
    delete process.env.ISSUE_NUMBER
    delete process.env.TRIGGER_TYPE
    delete process.env.RUN_ID
    delete process.env.RUN_URL
    delete process.env.VERSION
    delete process.env.FRESH
    delete process.env.COMPLEXITY
    delete process.env.COMMENT_BODY
    delete process.env.IS_PULL_REQUEST
    delete process.env.GITHUB_ACTOR
    delete process.env.ISSUE_CREATOR
    delete process.env.GITHUB_ACTIONS
  })

  afterEach(() => {
    // Restore original env
    Object.assign(process.env, originalEnv)
  })

  it('should parse --task-id flag', () => {
    const result = parseCliArgs(['--task-id', '260218-custom-task'])
    expect(result.taskId).toBe('260218-custom-task')
  })

  it('should parse --mode flag', () => {
    const result = parseCliArgs(['--mode', 'spec'])
    expect(result.mode).toBe('spec')
  })

  it('should parse --dry-run flag', () => {
    const result = parseCliArgs(['--dry-run'])
    expect(result.dryRun).toBe(true)
  })

  it('should parse --from flag with valid stage', () => {
    const result = parseCliArgs(['--from', 'build'])
    expect(result.fromStage).toBe('build')
  })

  it('should parse positional mode argument', () => {
    const result = parseCliArgs(['impl'])
    expect(result.mode).toBe('impl')
  })

  it('should default mode to full when not specified', () => {
    const result = parseCliArgs([])
    expect(result.mode).toBe('full')
  })

  it('should parse --clarify flag', () => {
    const result = parseCliArgs(['--clarify'])
    expect(result.clarify).toBe(true)
  })

  it('should parse --auto flag', () => {
    const result = parseCliArgs(['--auto'])
    expect(result.controlMode).toBe('auto')
  })

  it('should parse --gate flag', () => {
    const result = parseCliArgs(['--gate'])
    expect(result.controlMode).toBe('risk-gated')
  })

  it('should parse --hard-stop flag', () => {
    const result = parseCliArgs(['--hard-stop'])
    expect(result.controlMode).toBe('hard-stop')
  })

  it('should parse --fresh flag', () => {
    const result = parseCliArgs(['--fresh'])
    expect(result.fresh).toBe(true)
  })

  it('should parse --complexity flag', () => {
    const result = parseCliArgs(['--complexity', '50'])
    expect(result.complexityOverride).toBe(50)
  })

  it('should reject invalid --complexity value', () => {
    expect(() => parseCliArgs(['--complexity', '150'])).toThrow()
    expect(() => parseCliArgs(['--complexity', '0'])).toThrow()
  })

  it('should parse --version flag', () => {
    const result = parseCliArgs(['--version', 'v1.0.0'])
    expect(result.version).toBe('v1.0.0')
  })

  it('should parse --is-pull-request flag', () => {
    const result = parseCliArgs(['--is-pull-request'])
    expect(result.isPullRequest).toBe(true)
  })

  it('should parse --comment-body flag', () => {
    const result = parseCliArgs(['--comment-body', '@cody impl'])
    expect(result.commentBody).toBe('@cody impl')
    expect(result.triggerType).toBe('comment')
  })

  it('should reject invalid --mode value', () => {
    expect(() => parseCliArgs(['--mode', 'invalid'])).toThrow()
  })

  it('should reject invalid --from stage', () => {
    expect(() => parseCliArgs(['--from', 'invalid-stage'])).toThrow()
  })
})

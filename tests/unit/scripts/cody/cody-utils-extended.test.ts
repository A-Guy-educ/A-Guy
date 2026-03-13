import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process and fs before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
}))

// Mock pino logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
  trace: vi.fn(),
  silent: vi.fn(),
  level: 'info',
}))

vi.mock('../../../../scripts/cody/logger', () => ({
  logger: mockLogger,
  createStageLogger: vi.fn().mockReturnValue(mockLogger),
}))

import * as fs from 'fs'
import * as childProcess from 'child_process'

import {
  parseCommentBody,
  parseCliArgs,
  formatDuration,
  formatStatusComment,
  initStatus,
  readStatus,
  writeStatus,
  updateStageStatus,
  completeStatus,
  getTaskDir,
  ensureTaskDir,
  isValidMode,
  isValidStage,
  type CodyInput,
  type CodyPipelineStatus,
} from '../../../../scripts/cody/cody-utils'
import { resetEnv } from '../../../../scripts/cody/env'

// ---------------------------------------------------------------------------
// parseCommentBody
// ---------------------------------------------------------------------------

describe('parseCommentBody', () => {
  it('should parse "/cody" with no arguments as full mode, empty task-id', () => {
    const result = parseCommentBody('/cody')
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('full')
    expect(result.input?.taskId).toBe('')
    expect(result.input?.triggerType).toBe('comment')
  })

  it('should parse "/cody 260218-user-metrics" as full mode with task-id', () => {
    const result = parseCommentBody('/cody 260218-user-metrics')
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('full')
    expect(result.input?.taskId).toBe('260218-user-metrics')
  })

  it('should parse "/cody spec 260218-user-metrics" as spec mode', () => {
    const result = parseCommentBody('/cody spec 260218-user-metrics')
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('spec')
    expect(result.input?.taskId).toBe('260218-user-metrics')
  })

  it('should parse "/cody impl 260218-user-metrics" as impl mode', () => {
    const result = parseCommentBody('/cody impl 260218-user-metrics')
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('impl')
    expect(result.input?.taskId).toBe('260218-user-metrics')
  })

  it('should parse "/cody rerun 260218-task --feedback fix-this" with feedback', () => {
    const result = parseCommentBody('/cody rerun 260218-task --feedback fix-this')
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('rerun')
    expect(result.input?.taskId).toBe('260218-task')
    expect(result.input?.feedback).toBe('fix-this')
  })

  it('should parse "/cody rerun 260218-task --from build --feedback fix" with fromStage and feedback', () => {
    const result = parseCommentBody('/cody rerun 260218-task --from build --feedback fix')
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('rerun')
    expect(result.input?.taskId).toBe('260218-task')
    expect(result.input?.fromStage).toBe('build')
    expect(result.input?.feedback).toBe('fix')
  })

  it('should treat unknown subcommand as rerun with implicit feedback', () => {
    const result = parseCommentBody('/cody badcommand')
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('rerun')
    expect(result.input?.feedback).toBe('badcommand')
    expect(result.input?.taskId).toBe('')
  })

  it('should treat invalid task-id format as empty (auto-discovery)', () => {
    // When user provides text that doesn't match task-id pattern with a valid mode,
    // treat it as no task-id provided - will be auto-discovered from issue
    const result = parseCommentBody('/cody spec bad-task-id')
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('spec')
    expect(result.input?.taskId).toBe('')
  })

  it('should decode JSON-encoded body (starts/ends with quotes)', () => {
    // jq -Rs wraps the body in quotes and escapes special chars
    const jsonEncoded = '"/cody spec 260218-my-task"'
    const result = parseCommentBody(jsonEncoded)
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('spec')
    expect(result.input?.taskId).toBe('260218-my-task')
  })

  it('should normalize literal \\n sequences to real newlines', () => {
    // The body has literal \n that should become real newlines, only first line parsed
    const body = '/cody spec 260218-my-task\\nsome extra text on second line'
    const result = parseCommentBody(body)
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('spec')
    expect(result.input?.taskId).toBe('260218-my-task')
  })

  it('should only parse the first line of a multiline comment', () => {
    const body = '/cody impl 260218-feature\nThis is a longer description\nWith multiple lines'
    const result = parseCommentBody(body)
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('impl')
    expect(result.input?.taskId).toBe('260218-feature')
  })

  it('should parse --dry-run flag', () => {
    const result = parseCommentBody('/cody spec 260218-task --dry-run')
    expect(result.success).toBe(true)
    expect(result.input?.dryRun).toBe(true)
  })

  it('should have dryRun=false when --dry-run is not present', () => {
    const result = parseCommentBody('/cody spec 260218-task')
    expect(result.success).toBe(true)
    expect(result.input?.dryRun).toBe(false)
  })

  it('should return error for invalid --from stage', () => {
    const result = parseCommentBody('/cody rerun 260218-task --from banana')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid stage: banana')
    expect(result.errorComment).toContain('banana')
    expect(result.errorComment).toContain('Valid')
  })

  it('should accept valid --from stages', () => {
    const validStages = [
      'taskify',
      'gap',
      'clarify',
      'architect',
      'plan-gap',
      'build',
      'commit',
      'verify',
      'autofix',
      'pr',
    ]
    for (const stage of validStages) {
      const result = parseCommentBody(`/cody rerun 260218-task --from ${stage}`)
      expect(result.success).toBe(true)
      expect(result.input?.fromStage).toBe(stage)
    }
  })

  it('should pass issueNumber through to the result', () => {
    const result = parseCommentBody('/cody spec 260218-task', 42)
    expect(result.success).toBe(true)
    expect(result.input?.issueNumber).toBe(42)
  })

  it('should handle "/cody status" as status mode with no task-id', () => {
    const result = parseCommentBody('/cody status')
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('status')
    expect(result.input?.taskId).toBe('')
  })

  it('should handle "/cody full 260218-task" explicitly', () => {
    const result = parseCommentBody('/cody full 260218-task')
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('full')
    expect(result.input?.taskId).toBe('260218-task')
  })

  it('should handle JSON-encoded body that fails to parse gracefully', () => {
    // Starts and ends with quotes but isn't valid JSON
    const malformed = '"this is not valid json because it has "nested" quotes"'
    // Should fall through to use the raw value; subCmd will be an unknown command
    const result = parseCommentBody(malformed)
    // The raw string doesn't start with /cody, so parsing is best-effort
    expect(result).toBeDefined()
  })

  it('should handle "/cody  " with trailing whitespace as full mode', () => {
    const result = parseCommentBody('/cody  ')
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('full')
    expect(result.input?.taskId).toBe('')
  })

  it('should handle task-id with options when task-id is the subcommand', () => {
    // /cody 260218-task --dry-run → full mode, task-id parsed, dry-run set
    const result = parseCommentBody('/cody 260218-task --dry-run')
    expect(result.success).toBe(true)
    expect(result.input?.mode).toBe('full')
    expect(result.input?.taskId).toBe('260218-task')
    expect(result.input?.dryRun).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// parseCliArgs
// ---------------------------------------------------------------------------

describe('parseCliArgs', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset process.env.GITHUB_ACTIONS for local mode detection
    process.env = { ...originalEnv }
    // Default: pretend we're NOT in GH Actions so local defaults to true
    delete process.env.GITHUB_ACTIONS
    // Reset env cache so the above process.env changes are picked up
    resetEnv()
    // Mock discoverTaskIdFromIssue's execFileSync calls to return no result
    vi.mocked(childProcess.execFileSync).mockReturnValue('')
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
    resetEnv()
  })

  it('should parse --task-id=260218-task --mode=impl (equals syntax)', () => {
    const result = parseCliArgs(['--task-id=260218-task', '--mode=impl'])
    expect(result.taskId).toBe('260218-task')
    expect(result.mode).toBe('impl')
  })

  it('should parse --task-id 260218-task --mode impl (space-separated)', () => {
    const result = parseCliArgs(['--task-id', '260218-task', '--mode', 'impl'])
    expect(result.taskId).toBe('260218-task')
    expect(result.mode).toBe('impl')
  })

  it('should parse --dry-run flag', () => {
    const result = parseCliArgs(['--task-id', '260218-task', '--dry-run'])
    expect(result.dryRun).toBe(true)
  })

  it('should default dryRun to false', () => {
    const result = parseCliArgs(['--task-id', '260218-task'])
    expect(result.dryRun).toBe(false)
  })

  it('should parse --feedback "some feedback"', () => {
    const result = parseCliArgs(['--task-id', '260218-task', '--feedback', 'some feedback'])
    expect(result.feedback).toBe('some feedback')
  })

  it('should parse --from build with valid stage', () => {
    const result = parseCliArgs(['--task-id', '260218-task', '--from', 'build'])
    expect(result.fromStage).toBe('build')
  })

  it('should throw for --from banana (invalid stage)', () => {
    expect(() => parseCliArgs(['--task-id', '260218-task', '--from', 'banana'])).toThrow(
      /Invalid stage: banana/,
    )
  })

  it('should throw for --mode banana (invalid mode)', () => {
    expect(() => parseCliArgs(['--task-id', '260218-task', '--mode', 'banana'])).toThrow(
      /Invalid mode: banana/,
    )
  })

  it('should parse --issue-number 42', () => {
    const result = parseCliArgs(['--task-id', '260218-task', '--issue-number', '42'])
    // CLI args take precedence over env vars
    expect(result.issueNumber).toBe(42)
  })

  it('should parse --comment-body "/cody spec 260218-task" and merge parsed values', () => {
    const result = parseCliArgs(['--comment-body', '/cody spec 260218-task'])
    expect(result.mode).toBe('spec')
    expect(result.taskId).toBe('260218-task')
    expect(result.triggerType).toBe('comment')
    expect(result.commentBody).toBe('/cody spec 260218-task')
  })

  it('should treat unknown subcommand in --comment-body as rerun with implicit feedback', () => {
    const result = parseCliArgs(['--comment-body', '/cody badcommand'])
    expect(result.mode).toBe('rerun')
    expect(result.feedback).toBe('badcommand')
    expect(result.triggerType).toBe('comment')
  })

  it('should auto-generate task-id when not provided (format YYMMDD-auto-NNN)', () => {
    // Skip this test in CI since TASK_ID is provided via env
    if (process.env.TASK_ID) {
      return
    }

    const result = parseCliArgs(['--mode', 'full'])
    // The date prefix comes from new Date().toISOString() — we just verify the pattern
    // Counter is now 3 digits (100-999) from crypto.randomInt
    expect(result.taskId).toMatch(/^\d{6}-auto-\d{3}$/)
    expect(result.mode).toBe('full')
  })

  it('should generate task-id from --file path/to/feature.md', () => {
    // Skip this test in CI since TASK_ID is provided via env
    if (process.env.TASK_ID) {
      return
    }
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-02-18T12:00:00.000Z')

    const result = parseCliArgs(['--file', 'path/to/my-feature.md'])
    expect(result.taskId).toBe('260218-my-feature')
    expect(result.file).toBe('path/to/my-feature.md')
  })

  it('should parse --local flag', () => {
    const result = parseCliArgs(['--task-id', '260218-task', '--local'])
    expect(result.local).toBe(true)
  })

  it('should auto-detect local mode based on GITHUB_ACTIONS env var', () => {
    // Not in GitHub Actions → local = true
    delete process.env.GITHUB_ACTIONS
    resetEnv()
    const result1 = parseCliArgs(['--task-id', '260218-task'])
    expect(result1.local).toBe(true)

    // In GitHub Actions → local = false
    process.env.GITHUB_ACTIONS = 'true'
    resetEnv()
    const result2 = parseCliArgs(['--task-id', '260218-task'])
    expect(result2.local).toBe(false)
  })

  it('should throw for invalid task-id format', () => {
    expect(() => parseCliArgs(['--task-id', 'not-valid'])).toThrow(
      /Invalid task-id format: not-valid/,
    )
  })

  it('should discover task-id from issue when triggerType is comment', () => {
    // Skip this test in CI since TASK_ID is provided via env
    if (process.env.TASK_ID) {
      return
    }
    // Mock discoverTaskIdFromIssue to find a task
    vi.mocked(childProcess.execFileSync).mockReturnValue(
      '🎯 Task created: `260218-discovered-task`\n\nCody will now process this task.',
    )

    const result = parseCliArgs([
      '--issue-number',
      '42',
      '--trigger-type',
      'comment',
      '--comment-body',
      '/cody',
    ])
    expect(result.taskId).toBe('260218-discovered-task')
  })

  it('should default mode to full', () => {
    const result = parseCliArgs(['--task-id', '260218-task'])
    expect(result.mode).toBe('full')
  })

  it('should parse --run-id and --run-url', () => {
    const result = parseCliArgs([
      '--task-id',
      '260218-task',
      '--run-id',
      '12345',
      '--run-url',
      'https://github.com/runs/12345',
    ])
    // CLI args take precedence over env vars
    expect(result.runId).toBe('12345')
    expect(result.runUrl).toBe('https://github.com/runs/12345')
  })

  it('should parse --trigger-type', () => {
    const result = parseCliArgs(['--task-id', '260218-task', '--trigger-type', 'dispatch'])
    // CLI args take precedence over env vars
    expect(result.triggerType).toBe('dispatch')
  })

  it('should handle positional mode argument', () => {
    // Positional arg that's a valid mode
    const result = parseCliArgs(['spec', '--task-id', '260218-task'])
    expect(result.mode).toBe('spec')
  })

  it('should handle positional file path argument', () => {
    // Skip this test in CI since TASK_ID is provided via env
    if (process.env.TASK_ID) {
      return
    }
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-02-18T12:00:00.000Z')

    const result = parseCliArgs(['path/to/file.md'])
    expect(result.file).toBe('path/to/file.md')
    // Task-id should be generated from the file
    expect(result.taskId).toBe('260218-file')
  })

  it('should sanitize filename for task-id generation', () => {
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-02-18T12:00:00.000Z')

    const result = parseCliArgs(['--file', 'docs/My Feature (v2).md'])
    // Special chars replaced with -, lowercased
    expect(result.taskId).toBe('260218-my-feature--v2-')
  })
})

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  it('should format 0 ms as "0s"', () => {
    expect(formatDuration(0)).toBe('0s')
  })

  it('should format 5000 ms as "5s"', () => {
    expect(formatDuration(5000)).toBe('5s')
  })

  it('should format 65000 ms as "1m 5s"', () => {
    expect(formatDuration(65000)).toBe('1m 5s')
  })

  it('should format 120000 ms as "2m 0s"', () => {
    expect(formatDuration(120000)).toBe('2m 0s')
  })

  it('should format 500 ms as "0s" (floors to seconds)', () => {
    expect(formatDuration(500)).toBe('0s')
  })

  it('should format 61000 ms as "1m 1s"', () => {
    expect(formatDuration(61000)).toBe('1m 1s')
  })

  it('should format 59999 ms as "59s" (just under a minute)', () => {
    expect(formatDuration(59999)).toBe('59s')
  })
})

// ---------------------------------------------------------------------------
// formatStatusComment
// ---------------------------------------------------------------------------

describe('formatStatusComment', () => {
  const baseInput: CodyInput = {
    mode: 'full',
    taskId: '260218-test-task',
    dryRun: false,
  }

  const baseStatus: CodyPipelineStatus = {
    taskId: '260218-test-task',
    mode: 'full',
    pipeline: 'spec_execute_verify',
    startedAt: '2026-02-18T12:00:00.000Z',
    updatedAt: '2026-02-18T12:00:00.000Z',
    state: 'running',
    currentStage: null,
    stages: {},
    triggeredBy: 'dispatch',
  }

  it('should format running state with header line', () => {
    const comment = formatStatusComment(baseInput, { ...baseStatus, state: 'running' })
    expect(comment).toContain('🔄 Cody running for `260218-test-task`')
    expect(comment).toContain('(mode: full)')
  })

  it('should include runUrl when running', () => {
    const inputWithUrl = { ...baseInput, runUrl: 'https://github.com/runs/123' }
    const comment = formatStatusComment(inputWithUrl, { ...baseStatus, state: 'running' })
    expect(comment).toContain('Run: https://github.com/runs/123')
  })

  it('should format running state with stage list when currentStage is provided', () => {
    const status: CodyPipelineStatus = {
      ...baseStatus,
      state: 'running',
      stages: {
        spec: { state: 'completed', retries: 0, elapsed: 30000 },
        build: { state: 'running', retries: 0 },
        test: { state: 'pending', retries: 0 },
      },
    }
    const comment = formatStatusComment(baseInput, status, 'build')
    expect(comment).toContain('✅ spec (30s)')
    expect(comment).toContain('🔄 build')
    expect(comment).toContain('⏳ test')
  })

  it('should not render stage list when currentStage is not provided (even if stages exist)', () => {
    const status: CodyPipelineStatus = {
      ...baseStatus,
      state: 'running',
      stages: {
        spec: { state: 'completed', retries: 0 },
      },
    }
    const comment = formatStatusComment(baseInput, status)
    // No currentStage → no stage list
    expect(comment).not.toContain('✅ spec')
  })

  it('should show failed icon in stage list', () => {
    const status: CodyPipelineStatus = {
      ...baseStatus,
      state: 'running',
      stages: {
        build: { state: 'failed', retries: 0, elapsed: 45000 },
      },
    }
    const comment = formatStatusComment(baseInput, status, 'build')
    expect(comment).toContain('❌ build (45s)')
  })

  it('should format completed state', () => {
    const status = { ...baseStatus, state: 'completed' as const }
    const comment = formatStatusComment(baseInput, status)
    expect(comment).toContain('✅ Cody completed for `260218-test-task`!')
    expect(comment).toContain('Mode: full')
  })

  it('should format failed state', () => {
    const status = { ...baseStatus, state: 'failed' as const }
    const comment = formatStatusComment(baseInput, status)
    expect(comment).toContain('❌ Cody failed for `260218-test-task`')
  })

  it('should format timeout state', () => {
    const status = { ...baseStatus, state: 'timeout' as const }
    const comment = formatStatusComment(baseInput, status)
    expect(comment).toContain('⏰ Cody timed out for `260218-test-task`')
  })
})

// ---------------------------------------------------------------------------
// Status management: initStatus, readStatus, writeStatus,
//                    updateStageStatus, completeStatus
// ---------------------------------------------------------------------------

describe('status management', () => {
  const MOCK_CWD = '/mock/project'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(process, 'cwd').mockReturnValue(MOCK_CWD)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getTaskDir', () => {
    it('should return path under .tasks/<taskId>', () => {
      const dir = getTaskDir('260218-task')
      expect(dir).toBe(`${MOCK_CWD}/.tasks/260218-task`)
    })
  })

  describe('ensureTaskDir', () => {
    it('should create directory when it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      const dir = ensureTaskDir('260218-task')
      expect(fs.mkdirSync).toHaveBeenCalledWith(`${MOCK_CWD}/.tasks/260218-task`, {
        recursive: true,
      })
      expect(dir).toBe(`${MOCK_CWD}/.tasks/260218-task`)
    })

    it('should not create directory when it already exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      ensureTaskDir('260218-task')
      expect(fs.mkdirSync).not.toHaveBeenCalled()
    })
  })

  describe('readStatus', () => {
    it('should return null when status file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      const result = readStatus('260218-task')
      expect(result).toBeNull()
    })

    it('should return parsed status when file exists', () => {
      const mockStatus: CodyPipelineStatus = {
        taskId: '260218-task',
        mode: 'full',
        pipeline: 'spec_execute_verify',
        startedAt: '2026-02-18T12:00:00.000Z',
        updatedAt: '2026-02-18T12:00:00.000Z',
        state: 'running',
        currentStage: null,
        stages: {},
        triggeredBy: 'dispatch',
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStatus))

      const result = readStatus('260218-task')
      expect(result).toEqual(mockStatus)
    })

    it('should return null on invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue('not valid json {{{')

      const result = readStatus('260218-task')
      expect(result).toBeNull()
    })

    it('should return null when readFileSync throws', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied')
      })

      const result = readStatus('260218-task')
      expect(result).toBeNull()
    })
  })

  describe('writeStatus', () => {
    it('should write JSON status atomically via temp file + rename', () => {
      const mockStatus: CodyPipelineStatus = {
        taskId: '260218-task',
        mode: 'full',
        pipeline: 'spec_execute_verify',
        startedAt: '2026-02-18T12:00:00.000Z',
        updatedAt: '2026-02-18T12:00:00.000Z',
        state: 'running',
        currentStage: null,
        stages: {},
        triggeredBy: 'dispatch',
      }

      writeStatus('260218-task', mockStatus)

      // Should write to .tmp first (atomic write pattern)
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        `${MOCK_CWD}/.tasks/260218-task/status.json.tmp`,
        JSON.stringify(mockStatus, null, 2),
      )
      // Then rename .tmp to final
      expect((fs as Record<string, unknown>).renameSync).toHaveBeenCalledWith(
        `${MOCK_CWD}/.tasks/260218-task/status.json.tmp`,
        `${MOCK_CWD}/.tasks/260218-task/status.json`,
      )
    })
  })

  describe('initStatus', () => {
    it('should create a correct initial status and write it', () => {
      const input: CodyInput = {
        mode: 'spec',
        taskId: '260218-task',
        dryRun: false,
        triggerType: 'comment',
        issueNumber: 42,
        runId: 'run-123',
        runUrl: 'https://github.com/runs/123',
      }

      const status = initStatus(input)

      expect(status.taskId).toBe('260218-task')
      expect(status.mode).toBe('spec')
      expect(status.pipeline).toBe('spec_execute_verify')
      expect(status.state).toBe('running')
      expect(status.currentStage).toBeNull()
      expect(status.stages).toEqual({})
      expect(status.triggeredBy).toBe('comment')
      expect(status.issueNumber).toBe(42)
      expect(status.runId).toBe('run-123')
      expect(status.runUrl).toBe('https://github.com/runs/123')
      expect(status.startedAt).toBe(status.updatedAt)
      // Verify it was written
      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('should default triggeredBy to "dispatch" when triggerType is not set', () => {
      const input: CodyInput = {
        mode: 'full',
        taskId: '260218-task',
        dryRun: false,
      }

      const status = initStatus(input)
      expect(status.triggeredBy).toBe('dispatch')
    })
  })

  describe('updateStageStatus', () => {
    function setupMockStatus(stages: Record<string, unknown> = {}): CodyPipelineStatus {
      const mockStatus: CodyPipelineStatus = {
        taskId: '260218-task',
        mode: 'full',
        pipeline: 'spec_execute_verify',
        startedAt: '2026-02-18T12:00:00.000Z',
        updatedAt: '2026-02-18T12:00:00.000Z',
        state: 'running',
        currentStage: null,
        stages: stages as Record<string, import('../../../../scripts/cody/cody-utils').StageStatus>,
        triggeredBy: 'dispatch',
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStatus))
      return mockStatus
    }

    it('should warn and return when no status file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      mockLogger.warn.mockClear()

      updateStageStatus('260218-task', 'build', 'running')

      expect(mockLogger.warn).toHaveBeenCalledWith('No status file found for task: 260218-task')
      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })

    it('should create a new stage entry when stage does not exist and set to running', () => {
      setupMockStatus()

      updateStageStatus('260218-task', 'build', 'running')

      const writtenData = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      ) as CodyPipelineStatus
      expect(writtenData.stages.build).toBeDefined()
      expect(writtenData.stages.build.state).toBe('running')
      expect(writtenData.stages.build.startedAt).toBeDefined()
      expect(writtenData.currentStage).toBe('build')
    })

    it('should update existing stage to completed with elapsed time', () => {
      const startTime = '2026-02-18T12:00:00.000Z'
      setupMockStatus({
        build: { state: 'running', retries: 0, startedAt: startTime },
      })

      updateStageStatus('260218-task', 'build', 'completed')

      const writtenData = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      ) as CodyPipelineStatus
      expect(writtenData.stages.build.state).toBe('completed')
      expect(writtenData.stages.build.completedAt).toBeDefined()
      expect(writtenData.stages.build.elapsed).toBeGreaterThanOrEqual(0)
    })

    it('should set error on failed stage', () => {
      const startTime = '2026-02-18T12:00:00.000Z'
      setupMockStatus({
        build: { state: 'running', retries: 0, startedAt: startTime },
      })

      updateStageStatus('260218-task', 'build', 'failed', { error: 'Build crashed' })

      const writtenData = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      ) as CodyPipelineStatus
      expect(writtenData.stages.build.state).toBe('failed')
      expect(writtenData.stages.build.error).toBe('Build crashed')
    })

    it('should update currentStage only when state is running', () => {
      setupMockStatus({
        spec: { state: 'completed', retries: 0 },
      })

      // Complete a stage — currentStage should remain as-is (null from setup)
      updateStageStatus('260218-task', 'spec', 'completed')

      const writtenData = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      ) as CodyPipelineStatus
      // currentStage should be null since we completed, not started running
      expect(writtenData.currentStage).toBeNull()
    })

    it('should handle timeout state', () => {
      const startTime = '2026-02-18T12:00:00.000Z'
      setupMockStatus({
        build: { state: 'running', retries: 0, startedAt: startTime },
      })

      updateStageStatus('260218-task', 'build', 'timeout')

      const writtenData = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      ) as CodyPipelineStatus
      expect(writtenData.stages.build.state).toBe('timeout')
      expect(writtenData.stages.build.completedAt).toBeDefined()
    })

    it('should update updatedAt timestamp', () => {
      setupMockStatus()

      updateStageStatus('260218-task', 'build', 'running')

      const writtenData = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      ) as CodyPipelineStatus
      // updatedAt should be a valid ISO string that's different from the original
      expect(writtenData.updatedAt).toBeDefined()
      expect(new Date(writtenData.updatedAt).getTime()).toBeGreaterThan(0)
    })
  })

  describe('completeStatus', () => {
    it('should set state to completed and update timestamp', () => {
      const mockStatus: CodyPipelineStatus = {
        taskId: '260218-task',
        mode: 'full',
        pipeline: 'spec_execute_verify',
        startedAt: '2026-02-18T12:00:00.000Z',
        updatedAt: '2026-02-18T12:00:00.000Z',
        state: 'running',
        currentStage: 'build',
        stages: {},
        triggeredBy: 'dispatch',
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStatus))

      completeStatus('260218-task', 'completed')

      const writtenData = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      ) as CodyPipelineStatus
      expect(writtenData.state).toBe('completed')
      expect(writtenData.updatedAt).not.toBe('2026-02-18T12:00:00.000Z')
    })

    it('should set state to failed', () => {
      const mockStatus: CodyPipelineStatus = {
        taskId: '260218-task',
        mode: 'full',
        pipeline: 'spec_execute_verify',
        startedAt: '2026-02-18T12:00:00.000Z',
        updatedAt: '2026-02-18T12:00:00.000Z',
        state: 'running',
        currentStage: null,
        stages: {},
        triggeredBy: 'dispatch',
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStatus))

      completeStatus('260218-task', 'failed')

      const writtenData = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      ) as CodyPipelineStatus
      expect(writtenData.state).toBe('failed')
    })

    it('should do nothing when status file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      completeStatus('260218-task', 'completed')

      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })

    it('should set state to timeout', () => {
      const mockStatus: CodyPipelineStatus = {
        taskId: '260218-task',
        mode: 'full',
        pipeline: 'spec_execute_verify',
        startedAt: '2026-02-18T12:00:00.000Z',
        updatedAt: '2026-02-18T12:00:00.000Z',
        state: 'running',
        currentStage: null,
        stages: {},
        triggeredBy: 'dispatch',
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStatus))

      completeStatus('260218-task', 'timeout')

      const writtenData = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      ) as CodyPipelineStatus
      expect(writtenData.state).toBe('timeout')
    })
  })
})

// ---------------------------------------------------------------------------
// isValidMode / isValidStage (bonus coverage)
// ---------------------------------------------------------------------------

describe('isValidMode', () => {
  it('should accept all valid modes', () => {
    expect(isValidMode('spec')).toBe(true)
    expect(isValidMode('impl')).toBe(true)
    expect(isValidMode('rerun')).toBe(true)
    expect(isValidMode('full')).toBe(true)
    expect(isValidMode('status')).toBe(true)
  })

  it('should reject invalid modes', () => {
    expect(isValidMode('banana')).toBe(false)
    expect(isValidMode('')).toBe(false)
    expect(isValidMode('SPEC')).toBe(false)
  })
})

describe('isValidStage', () => {
  it('should accept all valid stages', () => {
    const stages = [
      'taskify',
      'gap',
      'clarify',
      'architect',
      'plan-gap',
      'build',
      'commit',
      'autofix',
      'verify',
      'pr',
    ]
    for (const stage of stages) {
      expect(isValidStage(stage)).toBe(true)
    }
  })

  it('should reject invalid stages', () => {
    expect(isValidStage('banana')).toBe(false)
    expect(isValidStage('')).toBe(false)
    expect(isValidStage('BUILD')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// --fresh and --is-pull-request flags
// ---------------------------------------------------------------------------

describe('--fresh and --is-pull-request CLI flags', () => {
  const savedFresh = process.env.FRESH

  afterEach(() => {
    // Restore FRESH env var to prevent CI env leak between tests
    if (savedFresh !== undefined) {
      process.env.FRESH = savedFresh
    } else {
      delete process.env.FRESH
    }
  })

  it('should parse --fresh flag', () => {
    const result = parseCliArgs(['--task-id', '260218-test', '--fresh'])
    expect(result.fresh).toBe(true)
  })

  it('should parse --is-pull-request flag', () => {
    const result = parseCliArgs(['--task-id', '260218-test', '--is-pull-request'])
    expect(result.isPullRequest).toBe(true)
  })

  it('should combine --fresh with --from', () => {
    const result = parseCliArgs(['--task-id', '260218-test', '--fresh', '--from', 'build'])
    expect(result.fresh).toBe(true)
    expect(result.fromStage).toBe('build')
  })

  it('should default fresh to undefined when FRESH env var is not set', () => {
    delete process.env.FRESH
    const result = parseCliArgs(['--task-id', '260218-test'])
    expect(result.fresh).toBeUndefined()
  })

  it('should default isPullRequest to undefined', () => {
    const result = parseCliArgs(['--task-id', '260218-test'])
    expect(result.isPullRequest).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// parseCommentBody --fresh flag
// ---------------------------------------------------------------------------

describe('parseCommentBody --fresh flag', () => {
  it('should parse --fresh flag in rerun mode', () => {
    const result = parseCommentBody('/cody rerun 260218-task --fresh')
    expect(result.success).toBe(true)
    expect(result.input?.fresh).toBe(true)
  })

  it('should parse --fresh flag with --from', () => {
    const result = parseCommentBody('/cody rerun 260218-task --fresh --from build')
    expect(result.success).toBe(true)
    expect(result.input?.fresh).toBe(true)
    expect(result.input?.fromStage).toBe('build')
  })

  it('should not set fresh when not provided', () => {
    const result = parseCommentBody('/cody rerun 260218-task')
    expect(result.success).toBe(true)
    expect(result.input?.fresh).toBe(false)
  })
})

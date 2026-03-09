/**
 * @fileType test
 * @domain cody | pipeline
 * @pattern unit-test
 * @ai-summary Tests for analyze-review-findings post-action — robust review parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// Mock all external dependencies
vi.mock('../../../../scripts/cody/pipeline-utils', () => ({
  readTask: vi.fn(),
  resolvePipelineProfile: vi.fn(() => 'standard'),
  resolveControlMode: vi.fn(() => 'auto'),
  stageOutputFile: vi.fn((taskDir: string, stage: string) => `${taskDir}/${stage}.md`),
  getComplexityTier: vi.fn(() => 'moderate'),
  STAGE_COMPLEXITY_THRESHOLDS: {
    taskify: 0,
    spec: 35,
    gap: 40,
    clarify: 60,
    architect: 10,
    'plan-gap': 50,
    build: 0,
    commit: 0,
    review: 30,
    fix: 0,
    'commit-fix': 0,
    verify: 0,
    autofix: 20,
    pr: 0,
  },
}))

vi.mock('../../../../scripts/cody/clarify-workflow', () => ({
  handleGateApproval: vi.fn(() => 'waiting'),
}))

vi.mock('../../../../scripts/cody/github-api', () => ({
  extractGateCommentBody: vi.fn(),
  postComment: vi.fn(),
  addIssueLabel: vi.fn(),
  removeIssueLabel: vi.fn(),
  setClassificationLabels: vi.fn(),
  setProfileLabel: vi.fn(),
  GATE_LABELS: { HARD_STOP: 'hard-stop', RISK_GATED: 'risk-gated' },
}))

vi.mock('../../../../scripts/cody/git-utils', () => ({
  commitPipelineFiles: vi.fn(),
}))

const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    trace: vi.fn(),
    silent: vi.fn(),
    level: 'info',
  }
  return { mockLogger }
})

vi.mock('../../../../scripts/cody/logger', () => ({
  logger: mockLogger,
  createStageLogger: vi.fn().mockReturnValue(mockLogger),
}))

// Mock engine/status — updateStage and writeState
const mockUpdateStage = vi.fn((_state, _name, update) => ({
  ..._state,
  stages: { ..._state.stages, [_name]: { ..._state.stages[_name], ...update } },
}))
const mockWriteState = vi.fn()

vi.mock('../../../../scripts/cody/engine/status', () => ({
  updateStage: (state: unknown, name: unknown, update: unknown) =>
    mockUpdateStage(state, name, update),
  writeState: (taskId: unknown, state: unknown) => mockWriteState(taskId, state),
  completeState: vi.fn(),
  loadState: vi.fn(),
}))

import { executePostAction } from '../../../../scripts/cody/pipeline/post-actions'
import type {
  PipelineContext,
  PipelineStateV2,
  PostAction,
} from '../../../../scripts/cody/engine/types'

describe('analyze-review-findings', () => {
  let ctx: PipelineContext
  let mockState: PipelineStateV2
  let tmpDir: string

  beforeEach(() => {
    vi.clearAllMocks()

    // Create real temp directory for review.md files
    tmpDir = fs.mkdtempSync(path.join('/tmp', 'cody-test-'))

    ctx = {
      taskId: 'test-task-123',
      taskDir: tmpDir,
      input: {
        taskId: 'test-task-123',
        mode: 'full' as const,
        dryRun: false,
      },
      taskDef: null,
      profile: 'standard',
      backend: { name: 'test-runner', spawn: vi.fn() },
    }

    mockState = {
      version: 2,
      taskId: 'test-task-123',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      state: 'running',
      cursor: 'review',
      stages: {
        review: { state: 'completed', retries: 0 },
      },
    }
  })

  afterEach(() => {
    // Clean up temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  const action: PostAction = { type: 'analyze-review-findings' }

  it('should detect critical issues with "Critical: N" format', async () => {
    fs.writeFileSync(path.join(tmpDir, 'review.md'), 'Critical: 3\nMajor: 1\nMinor: 2')
    await executePostAction(ctx, action, mockState)

    expect(mockUpdateStage).toHaveBeenCalledWith(
      mockState,
      'review',
      expect.objectContaining({
        issuesFound: true,
        reviewSummary: { critical: 3, major: 1, minor: 2 },
      }),
    )
  })

  it('should detect issues with "Critical Issues: N" format', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'review.md'),
      '## Summary\n\nCritical Issues: 2\nMajor Issues: 0',
    )
    await executePostAction(ctx, action, mockState)

    expect(mockUpdateStage).toHaveBeenCalledWith(
      mockState,
      'review',
      expect.objectContaining({ issuesFound: true }),
    )
  })

  it('should detect issues with "N critical" format', async () => {
    fs.writeFileSync(path.join(tmpDir, 'review.md'), 'Found 2 critical and 1 major issues.')
    await executePostAction(ctx, action, mockState)

    expect(mockUpdateStage).toHaveBeenCalledWith(
      mockState,
      'review',
      expect.objectContaining({ issuesFound: true }),
    )
  })

  it('should detect fix-required checkbox', async () => {
    fs.writeFileSync(path.join(tmpDir, 'review.md'), 'Fix Required: [x] Yes\nCritical: 0\nMajor: 0')
    await executePostAction(ctx, action, mockState)

    expect(mockUpdateStage).toHaveBeenCalledWith(
      mockState,
      'review',
      expect.objectContaining({ issuesFound: true }),
    )
  })

  it('should detect "must fix" keyword as issue indicator', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'review.md'),
      '## Issues\n\nThe function must fix the null check before deployment.',
    )
    await executePostAction(ctx, action, mockState)

    expect(mockUpdateStage).toHaveBeenCalledWith(
      mockState,
      'review',
      expect.objectContaining({ issuesFound: true }),
    )
  })

  it('should detect "security issue" keyword', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'review.md'),
      'There is a security issue with input validation.',
    )
    await executePostAction(ctx, action, mockState)

    expect(mockUpdateStage).toHaveBeenCalledWith(
      mockState,
      'review',
      expect.objectContaining({ issuesFound: true }),
    )
  })

  it('should set fixNeeded=false when no issues found', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'review.md'),
      '## Review\n\nAll looks good.\nCritical: 0\nMajor: 0\nMinor: 0',
    )
    await executePostAction(ctx, action, mockState)

    expect(mockUpdateStage).toHaveBeenCalledWith(
      mockState,
      'review',
      expect.objectContaining({ issuesFound: false }),
    )
  })

  it('should set fixNeeded=false when review.md does not exist', async () => {
    // Don't create review.md
    await executePostAction(ctx, action, mockState)

    expect(mockUpdateStage).toHaveBeenCalledWith(
      mockState,
      'review',
      expect.objectContaining({ issuesFound: false }),
    )
  })

  it('should always set fixNeeded=true in fix mode', async () => {
    // No issues in review, but mode is 'fix' — always needs fix
    fs.writeFileSync(
      path.join(tmpDir, 'review.md'),
      '## Review\n\nAll looks good.\nCritical: 0\nMajor: 0',
    )
    ctx.input.mode = 'fix'
    await executePostAction(ctx, action, mockState)

    expect(mockUpdateStage).toHaveBeenCalledWith(
      mockState,
      'review',
      expect.objectContaining({ issuesFound: true }),
    )
  })

  it('should always set fixNeeded=true in fix mode even without review.md', async () => {
    ctx.input.mode = 'fix'
    await executePostAction(ctx, action, mockState)

    expect(mockUpdateStage).toHaveBeenCalledWith(
      mockState,
      'review',
      expect.objectContaining({ issuesFound: true }),
    )
  })
})

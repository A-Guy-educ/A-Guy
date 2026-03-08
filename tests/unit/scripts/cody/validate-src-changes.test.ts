/**
 * @fileType test
 * @domain cody | pipeline-validation
 * @pattern validate-src-changes
 * @ai-summary Unit tests for validate-src-changes post-action, GitCommitHandler, and GitPrHandler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PipelineContext, PostAction } from '../../../../scripts/cody/engine/types'

// Mock child_process BEFORE imports
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}))

// Mock scripted-stages for git-handler tests
vi.mock('../../../../scripts/cody/scripted-stages', () => ({
  runCommitStage: vi.fn(),
  runPrStage: vi.fn(),
}))

// Mock fs for post-actions (it reads files)
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  }
})

// Mock other dependencies needed by post-actions.ts
vi.mock('../../../../scripts/cody/pipeline-utils', () => ({
  readTask: vi.fn(),
  resolvePipelineProfile: vi.fn(() => 'standard'),
  resolveControlMode: vi.fn(() => 'risk-gated'),
  stageOutputFile: vi.fn((taskDir: string, stage: string) => `${taskDir}/${stage}.md`),
  getComplexityTier: vi.fn(() => 'moderate'),
  STAGE_COMPLEXITY_THRESHOLDS: {},
}))

vi.mock('../../../../scripts/cody/clarify-workflow', () => ({
  handleGateApproval: vi.fn(),
  extractGateCommentBody: vi.fn(),
}))

vi.mock('../../../../scripts/cody/github-api', () => ({
  extractGateCommentBody: vi.fn(),
  postComment: vi.fn(),
  addIssueLabel: vi.fn(),
  removeIssueLabel: vi.fn(),
  GATE_LABELS: { HARD_STOP: 'hard-stop', RISK_GATED: 'risk-gated' },
}))

vi.mock('../../../../scripts/cody/git-utils', () => ({
  commitPipelineFiles: vi.fn(),
  getDefaultBranch: vi.fn().mockReturnValue('dev'),
}))

vi.mock('../../../../scripts/cody/engine/status', () => ({
  loadState: vi.fn(),
  writeState: vi.fn(),
  updateStage: vi.fn(),
}))

vi.mock('../../../../scripts/cody/agent-runner', () => ({
  runAgentWithFileWatch: vi.fn(),
  STAGE_TIMEOUTS: {},
  DEFAULT_TIMEOUT: 600000,
}))

import { execSync, execFileSync } from 'child_process'
import { executePostAction } from '../../../../scripts/cody/pipeline/post-actions'
import { GitCommitHandler, GitPrHandler } from '../../../../scripts/cody/handlers/git-handler'
import { runCommitStage, runPrStage } from '../../../../scripts/cody/scripted-stages'

describe('validate-src-changes post-action', () => {
  let ctx: PipelineContext

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = {
      taskId: 'test-task-123',
      taskDir: '/tmp/.tasks/test-task-123',
      input: {
        taskId: 'test-task-123',
        mode: 'full',
        dryRun: false,
      },
      taskDef: null,
      profile: 'standard',
      backend: { name: 'test', spawn: vi.fn() },
    }
  })

  it('should throw when no source files changed (only .tasks/ files)', async () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce('.tasks/test-task-123/build.md\n.tasks/test-task-123/plan.md') // git diff
      .mockReturnValueOnce('.tasks/test-task-123/status.json') // git ls-files

    const action: PostAction = { type: 'validate-src-changes' }

    await expect(executePostAction(ctx, action, null)).rejects.toThrow(
      'Build agent wrote build.md but did NOT modify any source files',
    )
  })

  it('should pass when source files changed', async () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce('src/ui/web/homepage/GreetingFlow/index.tsx\n.tasks/test/build.md') // git diff
      .mockReturnValueOnce('') // git ls-files

    const action: PostAction = { type: 'validate-src-changes' }

    await expect(executePostAction(ctx, action, null)).resolves.not.toThrow()
  })

  it('should pass when new untracked source files exist', async () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce('') // git diff (no modifications)
      .mockReturnValueOnce('tests/unit/new-test.test.ts') // git ls-files (new files)

    const action: PostAction = { type: 'validate-src-changes' }

    await expect(executePostAction(ctx, action, null)).resolves.not.toThrow()
  })

  it('should skip validation in dryRun mode', async () => {
    ctx.input.dryRun = true

    const action: PostAction = { type: 'validate-src-changes' }

    await expect(executePostAction(ctx, action, null)).resolves.not.toThrow()
    expect(execFileSync).not.toHaveBeenCalled()
  })

  it('should handle git command failures gracefully', async () => {
    vi.mocked(execFileSync)
      .mockImplementationOnce(() => {
        throw new Error('git failed')
      }) // git diff fails
      .mockReturnValueOnce('src/new-file.ts') // git ls-files still works

    const action: PostAction = { type: 'validate-src-changes' }

    await expect(executePostAction(ctx, action, null)).resolves.not.toThrow()
  })
})

describe('GitCommitHandler - No changes detection', () => {
  let handler: GitCommitHandler
  let ctx: PipelineContext

  beforeEach(() => {
    vi.clearAllMocks()
    handler = new GitCommitHandler()
    ctx = {
      taskId: 'test-task-123',
      taskDir: '/tmp/.tasks/test-task-123',
      input: { taskId: 'test-task-123', mode: 'full', dryRun: false },
      taskDef: null,
      profile: 'standard',
      backend: { name: 'test', spawn: vi.fn() },
    }
  })

  it('should fail with descriptive message when "No changes" reported', async () => {
    vi.mocked(runCommitStage).mockReturnValue({
      success: false,
      hash: '',
      branch: 'fix/test',
      message: 'No changes to commit',
      report: '',
    })

    const result = await handler.execute(ctx, {
      name: 'commit',
      type: 'git',
      timeout: 60000,
      maxRetries: 0,
    })

    expect(result.outcome).toBe('failed')
    expect(result.reason).toContain('No changes to commit after build stage')
  })

  it('should fail with original message for other failures', async () => {
    vi.mocked(runCommitStage).mockReturnValue({
      success: false,
      hash: '',
      branch: 'fix/test',
      message: 'Git push rejected',
      report: '',
    })

    const result = await handler.execute(ctx, {
      name: 'commit',
      type: 'git',
      timeout: 60000,
      maxRetries: 0,
    })

    expect(result.outcome).toBe('failed')
    expect(result.reason).toBe('Git push rejected')
  })

  it('should succeed when commit succeeds', async () => {
    vi.mocked(runCommitStage).mockReturnValue({
      success: true,
      hash: 'abc123',
      branch: 'fix/test',
      message: 'Committed successfully',
      report: '',
    })

    const result = await handler.execute(ctx, {
      name: 'commit',
      type: 'git',
      timeout: 60000,
      maxRetries: 0,
    })

    expect(result.outcome).toBe('completed')
  })
})

describe('GitPrHandler - Source changes validation', () => {
  let handler: GitPrHandler
  let ctx: PipelineContext

  beforeEach(() => {
    vi.clearAllMocks()
    handler = new GitPrHandler()
    ctx = {
      taskId: 'test-task-123',
      taskDir: '/tmp/.tasks/test-task-123',
      input: { taskId: 'test-task-123', mode: 'full', dryRun: false },
      taskDef: null,
      profile: 'standard',
      backend: { name: 'test', spawn: vi.fn() },
    }
  })

  it('should fail when no source files changed vs base branch', async () => {
    vi.mocked(execFileSync).mockReturnValue('.tasks/test/build.md\n.tasks/test/plan.md')

    const result = await handler.execute(ctx, {
      name: 'pr',
      type: 'git',
      timeout: 60000,
      maxRetries: 0,
    })

    expect(result.outcome).toBe('failed')
    expect(result.reason).toContain('No source files changed vs base branch')
  })

  it('should proceed when source files exist', async () => {
    vi.mocked(execFileSync).mockReturnValue('src/components/MyComponent.tsx\n.tasks/test/build.md')
    vi.mocked(runPrStage).mockResolvedValue({
      created: true,
      url: 'https://github.com/test/repo/pull/1',
      report: 'PR created',
    })

    const result = await handler.execute(ctx, {
      name: 'pr',
      type: 'git',
      timeout: 60000,
      maxRetries: 0,
    })

    expect(result.outcome).toBe('completed')
    expect(runPrStage).toHaveBeenCalled()
  })

  it('should proceed when git check fails (non-blocking)', async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('git failed')
    })
    vi.mocked(runPrStage).mockResolvedValue({
      created: true,
      url: 'https://github.com/test/repo/pull/1',
      report: 'PR created',
    })

    const result = await handler.execute(ctx, {
      name: 'pr',
      type: 'git',
      timeout: 60000,
      maxRetries: 0,
    })

    expect(result.outcome).toBe('completed')
    expect(runPrStage).toHaveBeenCalled()
  })
})

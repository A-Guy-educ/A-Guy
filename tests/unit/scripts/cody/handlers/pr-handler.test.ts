/**
 * @fileType test
 * @domain cody | handlers
 * @pattern pr-handler
 * @ai-summary Tests for GitPrHandler - PR creation stage handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}))

// Mock scripted-stages
vi.mock('../../../../../scripts/cody/scripted-stages', () => ({
  runPrStage: vi.fn(),
}))

// Mock git-utils
vi.mock('../../../../../scripts/cody/git-utils', () => ({
  getDefaultBranch: vi.fn().mockReturnValue('dev'),
}))

import * as childProcess from 'child_process'
import { GitPrHandler } from '../../../../../scripts/cody/handlers/git-handler'
import { runPrStage } from '../../../../../scripts/cody/scripted-stages'
import type { PipelineContext, StageDefinition } from '../../../../../scripts/cody/engine/types'

const mockExecFileSync = vi.mocked(childProcess.execFileSync)
const mockRunPrStage = vi.mocked(runPrStage)

const mockCtx: PipelineContext = {
  taskId: 'test-task-001',
  taskDir: '/tmp/test-tasks/test-task-001',
  input: {
    taskId: 'test-task-001',
    mode: 'full',
    dryRun: false,
    local: true,
    issueNumber: 123,
  },
  taskDef: null,
  profile: 'standard',
  backend: { name: 'test-runner' as const, spawn: vi.fn() },
}

const mockDef: StageDefinition = {
  name: 'pr',
  type: 'git',
  timeout: 300000,
  maxRetries: 0,
}

describe('GitPrHandler', () => {
  let handler: GitPrHandler

  beforeEach(() => {
    vi.clearAllMocks()
    handler = new GitPrHandler()
    // Default: git diff shows source changes
    mockExecFileSync.mockReturnValue('src/feature.ts\nsrc/test.ts\n')
  })

  it('returns completed when PR is created successfully', async () => {
    mockRunPrStage.mockResolvedValue({
      created: true,
      url: 'https://github.com/org/repo/pull/1',
      report: '',
    })

    const result = await handler.execute(mockCtx, mockDef)
    expect(result.outcome).toBe('completed')
  })

  it('returns failed when no source files changed', async () => {
    // Only task files changed
    mockExecFileSync.mockReturnValue('.tasks/test-task/task.json\n')

    const result = await handler.execute(mockCtx, mockDef)
    expect(result.outcome).toBe('failed')
    expect(result.reason).toContain('No source files changed')
  })

  it('returns failed when PR creation fails', async () => {
    mockRunPrStage.mockResolvedValue({ created: false, url: '', report: 'gh auth failed' })

    const result = await handler.execute(mockCtx, mockDef)
    expect(result.outcome).toBe('failed')
    expect(result.reason).toContain('gh auth failed')
  })

  it('proceeds when git diff fails (e.g. shallow clone)', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: bad revision')
    })
    mockRunPrStage.mockResolvedValue({
      created: true,
      url: 'https://github.com/org/repo/pull/2',
      report: '',
    })

    const result = await handler.execute(mockCtx, mockDef)
    expect(result.outcome).toBe('completed')
  })

  it('passes issueNumber to runPrStage', async () => {
    mockRunPrStage.mockResolvedValue({
      created: true,
      url: 'https://github.com/org/repo/pull/1',
      report: '',
    })

    await handler.execute(mockCtx, mockDef)
    expect(mockRunPrStage).toHaveBeenCalledWith(
      mockCtx.taskDir,
      expect.any(String),
      undefined,
      123,
      expect.any(Object),
    )
  })

  it('passes fresh flag to runPrStage options', async () => {
    const freshCtx = { ...mockCtx, input: { ...mockCtx.input, fresh: true } }
    mockRunPrStage.mockResolvedValue({
      created: true,
      url: 'https://github.com/org/repo/pull/1',
      report: '',
    })

    await handler.execute(freshCtx, mockDef)
    expect(mockRunPrStage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      undefined,
      expect.any(Number),
      expect.objectContaining({ fresh: true }),
    )
  })
})

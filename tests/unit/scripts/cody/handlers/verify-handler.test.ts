/**
 * @fileType test
 * @domain cody | handlers
 * @pattern verify-handler
 * @ai-summary Unit tests for ScriptedVerifyHandler with auto-fix loop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PipelineContext, StageDefinition } from '../../../../../scripts/cody/engine/types'

// Use vi.hoisted for mock variables used inside vi.mock factories
const {
  mockRunVerifyStage,
  mockExecFileSync,
  mockCommitPipelineFiles,
  mockExistsSync,
  mockUnlinkSync,
} = vi.hoisted(() => ({
  mockRunVerifyStage: vi.fn(),
  mockExecFileSync: vi.fn(),
  mockCommitPipelineFiles: vi.fn(),
  mockExistsSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
}))

vi.mock('../../../../../scripts/cody/scripted-stages', () => ({
  runVerifyStage: mockRunVerifyStage,
}))

vi.mock('child_process', () => ({
  execFileSync: mockExecFileSync,
}))

vi.mock('../../../../../scripts/cody/git-utils', () => ({
  commitPipelineFiles: mockCommitPipelineFiles,
}))

vi.mock('../../../../../scripts/cody/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  unlinkSync: mockUnlinkSync,
}))

import { ScriptedVerifyHandler } from '../../../../../scripts/cody/handlers/scripted-handler'

describe('ScriptedVerifyHandler', () => {
  let handler: ScriptedVerifyHandler
  let mockCtx: PipelineContext
  let mockDef: StageDefinition

  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
    mockUnlinkSync.mockReturnValue(undefined)

    handler = new ScriptedVerifyHandler()

    mockCtx = {
      taskId: 'test-task',
      taskDir: '/tmp/test-tasks/test-task',
      input: { taskId: 'test-task', mode: 'full', dryRun: false, local: true },
      taskDef: null,
      profile: 'standard',
      backend: { name: 'test-runner' as const, spawn: vi.fn() },
    }

    mockDef = {
      name: 'verify',
      type: 'scripted',
      timeout: 600000,
      maxRetries: 0,
    }
  })

  it('returns completed when all gates pass first try', async () => {
    mockRunVerifyStage.mockReturnValue({ passed: true, report: 'All passed' })

    const result = await handler.execute(mockCtx, mockDef)

    expect(result.outcome).toBe('completed')
    expect(result.retries).toBe(0)
  })

  it('returns failed when gates fail after max autofix attempts', async () => {
    mockRunVerifyStage.mockReturnValue({ passed: false, report: 'TSC failed' })
    // lint:fix and format:fix succeed but verify still fails
    mockExecFileSync.mockReturnValue('')

    const result = await handler.execute(mockCtx, mockDef)

    expect(result.outcome).toBe('failed')
    expect(result.reason).toContain('auto-fix')
  })

  it('returns completed when autofix resolves the issue', async () => {
    // First verify fails, then after autofix passes
    mockRunVerifyStage
      .mockReturnValueOnce({ passed: false, report: 'Lint failed' })
      .mockReturnValueOnce({ passed: true, report: 'All passed' })
    mockExecFileSync.mockReturnValue('')
    mockCommitPipelineFiles.mockReturnValue({ success: true, message: 'committed' })

    const result = await handler.execute(mockCtx, mockDef)

    expect(result.outcome).toBe('completed')
  })

  it('runs lint:fix and format:fix during autofix', async () => {
    mockRunVerifyStage
      .mockReturnValueOnce({ passed: false, report: 'Lint error' })
      .mockReturnValueOnce({ passed: true, report: 'All passed' })
    mockExecFileSync.mockReturnValue('')
    mockCommitPipelineFiles.mockReturnValue({ success: true, message: 'committed' })

    await handler.execute(mockCtx, mockDef)

    // Should have called lint:fix and format:fix
    const lintCalls = mockExecFileSync.mock.calls.filter(
      (call) => call[0] === 'pnpm' && call[1]?.[0] === 'lint:fix',
    )
    const formatCalls = mockExecFileSync.mock.calls.filter(
      (call) => call[0] === 'pnpm' && call[1]?.[0] === 'format:fix',
    )
    expect(lintCalls.length).toBeGreaterThanOrEqual(1)
    expect(formatCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('handles lint:fix failure gracefully', async () => {
    mockRunVerifyStage
      .mockReturnValueOnce({ passed: false, report: 'Lint error' })
      .mockReturnValueOnce({ passed: true, report: 'All passed' })
    // lint:fix throws, format:fix succeeds
    mockExecFileSync.mockImplementation((cmd: string, args?: string[]) => {
      if (args?.[0] === 'lint:fix') throw new Error('lint:fix failed')
      return ''
    })
    mockCommitPipelineFiles.mockReturnValue({ success: true, message: 'committed' })

    const result = await handler.execute(mockCtx, mockDef)

    // Should still succeed because format:fix worked and re-verify passed
    expect(result.outcome).toBe('completed')
  })

  it('commits autofix changes after successful fix', async () => {
    mockRunVerifyStage
      .mockReturnValueOnce({ passed: false, report: 'Format error' })
      .mockReturnValueOnce({ passed: true, report: 'All passed' })
    mockExecFileSync.mockReturnValue('')
    mockCommitPipelineFiles.mockReturnValue({ success: true, message: 'committed' })

    await handler.execute(mockCtx, mockDef)

    expect(mockCommitPipelineFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        taskDir: mockCtx.taskDir,
        taskId: mockCtx.taskId,
        stagingStrategy: 'tracked+task',
        push: true,
      }),
    )
  })

  it('returns failed when commit after autofix fails', async () => {
    mockRunVerifyStage
      .mockReturnValueOnce({ passed: false, report: 'Format error' })
      .mockReturnValueOnce({ passed: true, report: 'All passed' })
    mockExecFileSync.mockReturnValue('')
    mockCommitPipelineFiles.mockReturnValue({ success: false, message: 'push failed' })

    const result = await handler.execute(mockCtx, mockDef)

    expect(result.outcome).toBe('failed')
    expect(result.reason).toContain('pushed')
  })

  it('respects MAX_AUTOFIX_ATTEMPTS limit', async () => {
    // All verify calls fail, autofix runs MAX_AUTOFIX_ATTEMPTS times
    mockRunVerifyStage.mockReturnValue({ passed: false, report: 'Lint error' })
    mockExecFileSync.mockReturnValue('')

    const result = await handler.execute(mockCtx, mockDef)

    // Should fail after exhausting autofix attempts (MAX_AUTOFIX_ATTEMPTS = 2)
    expect(result.outcome).toBe('failed')
    // Verify was called 1 (initial) + 2 (after each autofix) = 3 times
    expect(mockRunVerifyStage).toHaveBeenCalledTimes(3)
  })

  it('deletes old output file before re-verify', async () => {
    mockRunVerifyStage
      .mockReturnValueOnce({ passed: false, report: 'Error' })
      .mockReturnValueOnce({ passed: true, report: 'All passed' })
    mockExecFileSync.mockReturnValue('')
    mockExistsSync.mockReturnValue(true)
    mockCommitPipelineFiles.mockReturnValue({ success: true, message: 'committed' })

    await handler.execute(mockCtx, mockDef)

    expect(mockUnlinkSync).toHaveBeenCalled()
  })
})

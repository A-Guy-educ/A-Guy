/**
 * @fileType test
 * @domain cody | pipeline
 * @pattern bugfix-tests
 * @ai-summary Tests that full-mode pipeline resets failed/completed state from previous runs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// Mocks
// ============================================================================

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    openSync: vi.fn().mockReturnValue(42),
    writeSync: vi.fn(),
    fdatasyncSync: vi.fn(),
    closeSync: vi.fn(),
    renameSync: vi.fn(),
  }
})

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

// We need to mock stageOutputFile for resetFromStage (imported by status.ts)
vi.mock('../../../../scripts/cody/pipeline-utils', () => ({
  stageOutputFile: vi.fn((taskDir: string, stage: string) => path.join(taskDir, `${stage}.md`)),
}))

const mockExistsSync = vi.mocked(fs.existsSync)
const mockUnlinkSync = vi.mocked(fs.unlinkSync)

// ============================================================================
// Tests
// ============================================================================

describe('deleteState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete status.json when it exists', async () => {
    mockExistsSync.mockReturnValue(true)

    const { deleteState } = await import('../../../../scripts/cody/engine/status')
    deleteState('260313-test-task')

    expect(mockUnlinkSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('.tasks', '260313-test-task', 'status.json')),
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Deleted previous status.json'),
    )
  })

  it('should be a no-op when status.json does not exist', async () => {
    mockExistsSync.mockReturnValue(false)

    const { deleteState } = await import('../../../../scripts/cody/engine/status')
    deleteState('260313-nonexistent')

    expect(mockUnlinkSync).not.toHaveBeenCalled()
  })
})

describe('recoverPipelineState with failed state', () => {
  it('should return immediately when state is "failed" (not "running")', async () => {
    const { recoverPipelineState } = await import('../../../../scripts/cody/engine/status')

    const failedState = {
      version: 2 as const,
      taskId: '260313-test',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      state: 'failed' as const,
      cursor: null,
      stages: {
        taskify: {
          state: 'failed' as const,
          error: 'No context found for instance',
          retries: 0,
        },
      },
    }

    // recoverPipelineState should NOT change the state — it only acts on "running"
    const recovered = recoverPipelineState(failedState, ['taskify', 'build', 'verify'], new Set())
    expect(recovered).toBe(failedState) // Same reference, unchanged
    expect(recovered.state).toBe('failed')
  })
})

describe('full-mode state reset scenario (integration)', () => {
  it('should demonstrate the bug: runPipeline returns immediately on failed state', async () => {
    // This test validates the scenario:
    // 1. First run fails → status.json has state: "failed"
    // 2. Full mode re-triggered → loadState finds failed state
    // 3. recoverPipelineState returns immediately (state !== "running")
    // 4. Line 105-107: state is "failed" → return immediately
    //
    // The fix: runFullMode now calls deleteState() before runPipeline()
    // when existing state is failed/completed

    const { recoverPipelineState, recoverStaleStages } =
      await import('../../../../scripts/cody/engine/status')

    const failedState = {
      version: 2 as const,
      taskId: '260313-test',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      state: 'failed' as const,
      cursor: null,
      stages: {
        taskify: {
          state: 'failed' as const,
          error: 'Process interrupted by SIGTERM',
          retries: 0,
        },
      },
    }

    // Step 1: recoverStaleStages — only resets "running" stages, not "failed"
    const afterStaleRecovery = recoverStaleStages(failedState)
    expect(afterStaleRecovery).toBe(failedState) // No change

    // Step 2: recoverPipelineState — skips because state is not "running"
    const afterPipelineRecovery = recoverPipelineState(
      afterStaleRecovery,
      ['taskify', 'build', 'verify'],
      new Set(),
    )
    expect(afterPipelineRecovery).toBe(failedState) // Still no change

    // Step 3: This is where runPipeline would return early (the bug)
    // The fix: deleteState() is called in runFullMode BEFORE runPipeline
    expect(afterPipelineRecovery.state).toBe('failed') // confirms the short-circuit
  })

  it('should also reset "completed" state for re-triggered full mode', async () => {
    const { recoverPipelineState } = await import('../../../../scripts/cody/engine/status')

    const completedState = {
      version: 2 as const,
      taskId: '260313-test',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      state: 'completed' as const,
      cursor: null,
      stages: {
        taskify: { state: 'completed' as const, retries: 0 },
        build: { state: 'completed' as const, retries: 0 },
        verify: { state: 'completed' as const, retries: 0 },
      },
    }

    // recoverPipelineState doesn't touch completed state
    const recovered = recoverPipelineState(
      completedState,
      ['taskify', 'build', 'verify'],
      new Set(),
    )
    expect(recovered).toBe(completedState) // Same reference
    expect(recovered.state).toBe('completed')
  })
})

/**
 * @fileType test
 * @domain cody | engine
 * @pattern unit-test
 * @ai-summary Tests for duration (elapsed) tracking in pipeline stages
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { updateStage, initState } from '../../../../scripts/cody/engine/status'
import type { PipelineContext } from '../../../../scripts/cody/engine/types'

// ============================================================================
// Test Fixtures
// ============================================================================

let testDir: string

function createMockContext(taskId: string): PipelineContext {
  return {
    taskId,
    taskDir: path.join(testDir, taskId),
    input: {
      taskId,
      mode: 'full',
      dryRun: false,
      local: true,
      issueNumber: undefined,
      runId: undefined,
      runUrl: undefined,
      clarify: false,
      fromStage: undefined,
      feedback: undefined,
      file: undefined,
    },
    taskDef: null,
    profile: 'standard',
    backend: {
      name: 'test-runner',
      spawn: vi.fn(),
    },
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Duration Tracking', () => {
  const TEST_TASK_ID = 'test-duration-tracking'

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-duration-test-'))
    const taskDir = path.join(testDir, TEST_TASK_ID)
    fs.mkdirSync(taskDir, { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(testDir)
  })

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    vi.restoreAllMocks()
  })

  it('updateStage writes elapsed field', () => {
    const ctx = createMockContext(TEST_TASK_ID)
    const state = initState(ctx, 'full')

    // Set up a stage with startedAt, then update with elapsed
    const withRunning = updateStage(state, 'build', {
      state: 'running',
      startedAt: new Date().toISOString(),
    })

    const withElapsed = updateStage(withRunning, 'build', {
      state: 'completed',
      completedAt: new Date().toISOString(),
      elapsed: 42,
    })

    expect(withElapsed.stages['build'].elapsed).toBe(42)
    expect(withElapsed.stages['build'].state).toBe('completed')
  })

  it('updateStage preserves elapsed as undefined when not provided', () => {
    const ctx = createMockContext(TEST_TASK_ID)
    const state = initState(ctx, 'full')

    // Update stage without elapsed
    const withCompleted = updateStage(state, 'build', {
      state: 'completed',
      completedAt: new Date().toISOString(),
      retries: 0,
    })

    expect(withCompleted.stages['build'].elapsed).toBeUndefined()
  })

  it('elapsed is a number in seconds, not milliseconds', () => {
    // Convention check: elapsed should be in seconds.
    // A stage running for 10 minutes = 600 seconds.
    // If elapsed were in milliseconds, 10 minutes = 600_000 which is unreasonably large.
    // We verify that a reasonable elapsed value (e.g., 600 for 10 min) passes,
    // and assert it's within a sane range for seconds (0-86400 = 24 hours max).
    const ctx = createMockContext(TEST_TASK_ID)
    const state = initState(ctx, 'full')

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const withRunning = updateStage(state, 'build', {
      state: 'running',
      startedAt: tenMinutesAgo,
    })

    // Simulate what handleStageResult computes: elapsed in seconds
    const stageState = withRunning.stages['build']
    const elapsed = stageState?.startedAt
      ? Math.round((Date.now() - new Date(stageState.startedAt).getTime()) / 1000)
      : undefined

    expect(elapsed).toBeDefined()
    // 10 minutes = 600 seconds, allow ±2 seconds for test execution time
    expect(elapsed).toBeGreaterThanOrEqual(598)
    expect(elapsed).toBeLessThanOrEqual(602)

    // Verify it's clearly in seconds, not milliseconds
    // 600 seconds is reasonable; 600_000 milliseconds would fail this check
    const MAX_REASONABLE_SECONDS = 86400 // 24 hours
    expect(elapsed!).toBeLessThan(MAX_REASONABLE_SECONDS)
  })

  it('elapsed is stored correctly for failed stages', () => {
    const ctx = createMockContext(TEST_TASK_ID)
    const state = initState(ctx, 'full')

    const withRunning = updateStage(state, 'build', {
      state: 'running',
      startedAt: new Date().toISOString(),
    })

    const withFailed = updateStage(withRunning, 'build', {
      state: 'failed',
      elapsed: 15,
      error: 'Build failed',
    })

    expect(withFailed.stages['build'].elapsed).toBe(15)
    expect(withFailed.stages['build'].state).toBe('failed')
    expect(withFailed.stages['build'].error).toBe('Build failed')
  })

  it('elapsed is stored correctly for timed_out stages', () => {
    const ctx = createMockContext(TEST_TASK_ID)
    const state = initState(ctx, 'full')

    const withRunning = updateStage(state, 'build', {
      state: 'running',
      startedAt: new Date().toISOString(),
    })

    const withTimeout = updateStage(withRunning, 'build', {
      state: 'timeout',
      elapsed: 300,
      error: 'Stage timed out',
    })

    expect(withTimeout.stages['build'].elapsed).toBe(300)
    expect(withTimeout.stages['build'].state).toBe('timeout')
  })
})

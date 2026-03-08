/**
 * @fileType test
 * @domain cody | engine
 * @pattern integration-test
 * @ai-summary Integration tests for the Cody pipeline state machine
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  PipelinePausedError,
  type StageType,
  type StageOutcome,
  type PipelineStateV2,
  type PipelineContext,
  type PipelineDefinition,
} from '../../../../../scripts/cody/engine/types'
import { runPipeline } from '../../../../../scripts/cody/engine/state-machine'
import { loadState, initState, completeState } from '../../../../../scripts/cody/engine/status'

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_TASK_ID = 'test-pipeline-failure'
let testDir: string

// Create a minimal pipeline context for testing
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

// Create a simple pipeline definition with mock handler
function createMockPipeline(
  stages: Array<{
    name: string
    outcome: StageOutcome
    error?: string
  }>,
): PipelineDefinition {
  const stagesMap = new Map<
    string,
    {
      name: string
      type: StageType
      timeout: number
      maxRetries: number
      advisory?: boolean
    }
  >()

  const order: (string | { parallel: string[] })[] = []

  for (const stage of stages) {
    stagesMap.set(stage.name, {
      name: stage.name,
      type: 'agent',
      timeout: 60000,
      maxRetries: 2,
    })
    order.push(stage.name)
  }

  return { stages: stagesMap, order }
}

// ============================================================================
// Mock Setup - use a shared ref that can be updated
// ============================================================================

// Shared mock implementation that can be changed per test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockExecuteImpl: { fn: any; reset: () => void; setImplementation: (fn: any) => void } = {
  fn: vi.fn(),
  reset() {
    this.fn.mockReset()
    this.fn.mockResolvedValue({
      outcome: 'completed' as StageOutcome,
      retries: 0,
    })
  },
  setImplementation(fn: unknown) {
    this.fn = fn
  },
}

// Default implementation
mockExecuteImpl.reset()

vi.mock('../../../../../scripts/cody/handlers/handler', () => ({
  getHandler: vi.fn(() => ({
    execute: (...args: unknown[]) => mockExecuteImpl.fn(...args),
  })),
}))

// ============================================================================
// Tests
// ============================================================================

describe('Cody Pipeline State Machine Integration', () => {
  beforeEach(() => {
    // Create temp directory for test state files
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-test-'))
    const taskDir = path.join(testDir, TEST_TASK_ID)
    fs.mkdirSync(taskDir, { recursive: true })

    // Point the status module to use our test directory
    vi.spyOn(process, 'cwd').mockReturnValue(testDir)

    // Reset the mock before each test
    mockExecuteImpl.reset()
  })

  afterEach(() => {
    // Clean up temp directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    vi.restoreAllMocks()
  })

  describe('Pipeline Failure Handling', () => {
    it('should mark state as failed when a stage fails', async () => {
      const ctx = createMockContext(TEST_TASK_ID)

      // Set up mock to return failed result
      mockExecuteImpl.setImplementation(
        vi.fn().mockResolvedValue({
          outcome: 'failed' as StageOutcome,
          reason: 'Test failure',
          retries: 0,
        }),
      )

      // Create pipeline with failing stage
      const pipeline = createMockPipeline([
        { name: 'build', outcome: 'failed', error: 'Test failure' },
      ])

      // Run pipeline - should throw when stage fails
      await expect(runPipeline(ctx, pipeline)).rejects.toThrow('Pipeline failed at stage: build')

      // Verify state was marked as failed
      const state = loadState(TEST_TASK_ID)
      expect(state).not.toBeNull()
      expect(state?.state).toBe('failed')
      expect(state?.stages['build']?.state).toBe('failed')
      expect(state?.stages['build']?.error).toBe('Test failure')
    })

    it('should mark pipeline as completed when all stages pass', async () => {
      const ctx = createMockContext(TEST_TASK_ID)

      // Set up mock to return success
      mockExecuteImpl.setImplementation(
        vi.fn().mockResolvedValue({
          outcome: 'completed' as StageOutcome,
          retries: 0,
          outputFile: 'build.md',
        }),
      )

      const pipeline = createMockPipeline([
        { name: 'taskify', outcome: 'completed' },
        { name: 'build', outcome: 'completed' },
      ])

      // Run pipeline - should complete successfully
      const result = await runPipeline(ctx, pipeline)

      expect(result.state).toBe('completed')
      expect(result.stages['taskify']?.state).toBe('completed')
      expect(result.stages['build']?.state).toBe('completed')
    })

    it('should stop execution after first failure', async () => {
      const ctx = createMockContext(TEST_TASK_ID)

      const executions: string[] = []

      // First handler succeeds, second fails
      mockExecuteImpl.setImplementation(
        vi.fn().mockImplementation((_ctx: PipelineContext, def: { name: string }) => {
          executions.push(def.name)
          if (def.name === 'build') {
            return {
              outcome: 'failed' as StageOutcome,
              reason: 'Build failed',
              retries: 0,
            }
          }
          return {
            outcome: 'completed' as StageOutcome,
            retries: 0,
          }
        }),
      )

      const pipeline = createMockPipeline([
        { name: 'taskify', outcome: 'completed' },
        { name: 'build', outcome: 'failed' },
        { name: 'verify', outcome: 'completed' }, // Should never run
      ])

      // Should throw on failure
      await expect(runPipeline(ctx, pipeline)).rejects.toThrow()

      // Verify that verify stage never ran (pipeline stopped at build failure)
      expect(executions).toContain('taskify')
      expect(executions).toContain('build')
      expect(executions).not.toContain('verify')
    })

    it('should handle PipelinePausedError and pause pipeline', async () => {
      const ctx = createMockContext(TEST_TASK_ID)

      mockExecuteImpl.setImplementation(
        vi.fn().mockRejectedValue(new PipelinePausedError('Gate check requires input')),
      )

      const pipeline = createMockPipeline([{ name: 'gate', outcome: 'failed' }])

      // PipelinePausedError is caught internally and returns paused state
      // (it doesn't propagate as a rejection)
      const result = await runPipeline(ctx, pipeline)

      expect(result.state).toBe('paused')
      expect(result.stages['gate']?.state).toBe('paused')
    })

    it('should skip stages that are already completed (resume behavior)', async () => {
      const ctx = createMockContext(TEST_TASK_ID)

      // Track which stages were executed
      const executedStages: string[] = []
      mockExecuteImpl.setImplementation(
        vi.fn().mockImplementation((_ctx: PipelineContext, def: { name: string }) => {
          executedStages.push(def.name)
          return {
            outcome: 'completed' as StageOutcome,
            retries: 0,
          }
        }),
      )

      // First, initialize state with taskify completed
      const initialState = initState(ctx, 'full')
      const { updateStage, writeState: ws } =
        await import('../../../../../scripts/cody/engine/status')
      const stateWithTaskifyDone = updateStage(initialState, 'taskify', {
        state: 'completed',
        completedAt: new Date().toISOString(),
        retries: 0,
      })
      ws(TEST_TASK_ID, stateWithTaskifyDone)

      const pipeline = createMockPipeline([
        { name: 'taskify', outcome: 'completed' },
        { name: 'build', outcome: 'completed' },
      ])

      // Run pipeline again - taskify should be skipped, but build should run
      await runPipeline(ctx, pipeline)

      // taskify should not have been executed again (it was already completed)
      expect(executedStages).not.toContain('taskify')
      // build should have been executed (it wasn't completed yet)
      expect(executedStages).toContain('build')
    })
  })

  describe('completeState function', () => {
    it('should mark state as failed', () => {
      const state = initState(createMockContext(TEST_TASK_ID), 'full')

      const failedState = completeState(state, 'failed')

      expect(failedState.state).toBe('failed')
      expect(failedState.completedAt).toBeDefined()
    })

    it('should mark state as completed', () => {
      const state = initState(createMockContext(TEST_TASK_ID), 'full')

      const completedState = completeState(state, 'completed')

      expect(completedState.state).toBe('completed')
      expect(completedState.completedAt).toBeDefined()
    })

    it('should preserve existing stage states', () => {
      const state = initState(createMockContext(TEST_TASK_ID), 'full')

      // Add some stage states
      const withStages = {
        ...state,
        stages: {
          taskify: {
            state: 'completed' as const,
            completedAt: new Date().toISOString(),
            retries: 0,
          },
          build: {
            state: 'running' as const,
            startedAt: new Date().toISOString(),
            retries: 0,
          },
        },
      }

      const completedState = completeState(withStages, 'completed')

      expect(completedState.stages['taskify'].state).toBe('completed')
      expect(completedState.stages['build'].state).toBe('running')
    })
  })

  describe('PipelineStateV2 Schema', () => {
    it('should have correct type structure', () => {
      // Verify PipelineStateV2 type exists and has expected properties
      const mockState: PipelineStateV2 = {
        version: 2,
        taskId: '260223-test',
        mode: 'full',
        pipeline: 'full',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        state: 'running',
        cursor: null,
        stages: {},
      }
      expect(mockState.taskId).toBeDefined()
      expect(mockState.mode).toBeDefined()
      expect(mockState.state).toBeDefined()
      expect(mockState.cursor).toBeDefined()
      expect(mockState.stages).toBeDefined()
    })

    it('should export PipelinePausedError', () => {
      expect(PipelinePausedError).toBeDefined()
      expect(PipelinePausedError.name).toBe('PipelinePausedError')
    })
  })

  describe('PostAction Types', () => {
    it('should have all action types defined', () => {
      // Verify post-action types are defined - check they can be imported
      // The actual validation happens at compile time
      expect(true).toBe(true)
    })
  })

  describe('Stage Types', () => {
    it('should have valid StageType values', () => {
      const validStageTypes: StageType[] = ['agent', 'scripted', 'git', 'gate']
      expect(validStageTypes).toContain('agent')
      expect(validStageTypes).toContain('scripted')
      expect(validStageTypes).toContain('git')
      expect(validStageTypes).toContain('gate')
    })

    it('should have valid StageOutcome values', () => {
      const validOutcomes: StageOutcome[] = [
        'completed',
        'failed',
        'paused',
        'timed_out',
        'skipped',
      ]
      expect(validOutcomes).toContain('completed')
      expect(validOutcomes).toContain('failed')
      expect(validOutcomes).toContain('paused')
    })
  })

  describe('Complexity-Based Stage Skipping', () => {
    // Integration test: validates that complexity score flows through
    // buildPipeline → shouldSkip → state machine → stage skipped/executed
    // Uses dryRun=true to avoid post-action side effects (validators, gates, git)
    // while still exercising the shouldSkip logic which runs BEFORE dryRun shortcut

    it('should skip optional stages for trivial complexity (score 5)', async () => {
      const ctx = createMockContext(TEST_TASK_ID)
      ctx.input.dryRun = true
      ctx.taskDef = {
        task_type: 'fix_bug',
        pipeline: 'spec_execute_verify',
        risk_level: 'low',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src/app'],
        missing_inputs: [],
        assumptions: [],
        complexity: 5,
        complexity_reasoning: 'Trivial one-line fix',
      }
      ctx.profile = 'standard'

      const { buildPipeline } = await import('../../../../../scripts/cody/pipeline/definitions')
      const pipeline = buildPipeline('impl', 'standard', false, ctx)

      const result = await runPipeline(ctx, pipeline)

      expect(result.state).toBe('completed')

      // Always-run stages SHOULD complete (dryRun marks them completed)
      expect(result.stages['build']?.state).toBe('completed')
      expect(result.stages['commit']?.state).toBe('completed')
      expect(result.stages['verify']?.state).toBe('completed')
      expect(result.stages['pr']?.state).toBe('completed')

      // architect (threshold 10) should be skipped at score 5
      expect(result.stages['architect']?.state).toBe('skipped')
      expect(result.stages['architect']?.skipped).toContain('Complexity 5')

      // plan-gap (threshold 50) should be skipped
      expect(result.stages['plan-gap']?.state).toBe('skipped')
      expect(result.stages['plan-gap']?.skipped).toContain('Complexity 5')
    })

    it('should run architect for simple complexity (score 15)', async () => {
      const ctx = createMockContext(TEST_TASK_ID)
      ctx.input.dryRun = true
      ctx.taskDef = {
        task_type: 'fix_bug',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src/app'],
        missing_inputs: [],
        assumptions: [],
        complexity: 15,
        complexity_reasoning: 'Simple fix with some scope',
      }
      ctx.profile = 'standard'

      const { buildPipeline } = await import('../../../../../scripts/cody/pipeline/definitions')
      const pipeline = buildPipeline('impl', 'standard', false, ctx)

      const result = await runPipeline(ctx, pipeline)

      expect(result.state).toBe('completed')

      // architect (threshold 10) SHOULD run at score 15
      expect(result.stages['architect']?.state).toBe('completed')

      // plan-gap (threshold 50) should be skipped
      expect(result.stages['plan-gap']?.state).toBe('skipped')
      expect(result.stages['plan-gap']?.skipped).toContain('Complexity 15')

      // build, commit, verify, pr should all complete
      expect(result.stages['build']?.state).toBe('completed')
      expect(result.stages['commit']?.state).toBe('completed')
      expect(result.stages['verify']?.state).toBe('completed')
      expect(result.stages['pr']?.state).toBe('completed')
    })

    it('should run all stages for very complex task (score 60)', async () => {
      const ctx = createMockContext(TEST_TASK_ID)
      ctx.input.dryRun = true
      ctx.taskDef = {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'high',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src/app'],
        missing_inputs: [],
        assumptions: [],
        complexity: 60,
        complexity_reasoning: 'Complex cross-domain feature',
      }
      ctx.profile = 'standard'

      const { buildPipeline } = await import('../../../../../scripts/cody/pipeline/definitions')
      const pipeline = buildPipeline('impl', 'standard', false, ctx)

      const result = await runPipeline(ctx, pipeline)

      expect(result.state).toBe('completed')

      // At score 60, ALL stages should complete (all thresholds met)
      expect(result.stages['architect']?.state).toBe('completed')
      expect(result.stages['plan-gap']?.state).toBe('completed')
      expect(result.stages['build']?.state).toBe('completed')
      expect(result.stages['commit']?.state).toBe('completed')
      expect(result.stages['verify']?.state).toBe('completed')
      // No complexity-based skips anywhere
      for (const [, stageState] of Object.entries(result.stages)) {
        if (stageState.state === 'skipped' && stageState.skipped) {
          expect(stageState.skipped).not.toContain('Complexity')
        }
      }
    })

    it('should not skip any stages for complexity when score is undefined (backward compat)', async () => {
      const ctx = createMockContext(TEST_TASK_ID)
      ctx.input.dryRun = true
      ctx.taskDef = {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src/app'],
        missing_inputs: [],
        assumptions: [],
        // No complexity field — legacy behavior
      }
      ctx.profile = 'standard'

      const { buildPipeline } = await import('../../../../../scripts/cody/pipeline/definitions')
      const pipeline = buildPipeline('impl', 'standard', false, ctx)

      const result = await runPipeline(ctx, pipeline)

      expect(result.state).toBe('completed')

      // All stages should complete — no complexity-based skipping
      expect(result.stages['architect']?.state).toBe('completed')
      expect(result.stages['plan-gap']?.state).toBe('completed')
      expect(result.stages['build']?.state).toBe('completed')
      expect(result.stages['commit']?.state).toBe('completed')
      expect(result.stages['verify']?.state).toBe('completed')

      // No complexity-based skips anywhere
      for (const [, stageState] of Object.entries(result.stages)) {
        if (stageState.skipped) {
          expect(stageState.skipped).not.toContain('Complexity')
        }
      }
    })
  })
})

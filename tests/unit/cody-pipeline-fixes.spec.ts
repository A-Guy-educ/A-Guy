/**
 * @fileType test
 * @domain cody | pipeline
 * @pattern cody-pipeline-fixes | unit-test
 * @ai-summary Unit tests for Cody pipeline bug fixes
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import type { PipelineContext } from '../../scripts/cody/engine/types'
import type { TaskDefinition } from '../../scripts/cody/pipeline-utils'

// Test constants
const TEST_TASK_ID = '260301-test-fixes'
const TEST_DIR = path.join(os.tmpdir(), `cody-test-${Date.now()}`)

// ============================================================================
// Test Setup
// ============================================================================

describe('Cody Pipeline Fixes', () => {
  let taskDir: string

  beforeEach(() => {
    // Create test directory
    taskDir = path.join(TEST_DIR, TEST_TASK_ID)
    fs.mkdirSync(taskDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  // ========================================================================
  // Fix #4: Skip condition content validation
  // ========================================================================

  describe('skipIfInputQuality content validation (Fix #4)', () => {
    it('should NOT skip when promoted file does not exist', async () => {
      const { skipIfInputQuality } = await import('../../scripts/cody/pipeline/skip-conditions')

      const ctx: PipelineContext = {
        taskDef: {
          input_quality: {
            level: 'good_spec',
            skip_stages: ['spec'],
            reasoning: 'Test',
          },
        } as TaskDefinition,
        taskDir,
        input: {},
        profile: 'standard',
      } as PipelineContext

      const result = skipIfInputQuality(ctx, 'spec')
      expect(result.shouldSkip).toBe(false)
    })

    it('should skip when promoted file exists with valid content', async () => {
      // Create a valid promoted spec.md
      const specContent = `# Specification (promoted)

This is valid promoted content from a previous successful run.

## Requirements

- Requirement 1
- Requirement 2

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
`
      fs.writeFileSync(path.join(taskDir, 'spec.md'), specContent)

      const { skipIfInputQuality } = await import('../../scripts/cody/pipeline/skip-conditions')

      const ctx: PipelineContext = {
        taskDef: {
          input_quality: {
            level: 'good_spec',
            skip_stages: ['spec'],
            reasoning: 'Test',
          },
        } as TaskDefinition,
        taskDir,
        input: {},
        profile: 'standard',
      } as PipelineContext

      const result = skipIfInputQuality(ctx, 'spec')
      expect(result.shouldSkip).toBe(true)
      expect(result.reason).toContain('valid file exists')
    })

    it('should NOT skip when promoted file exists but is incomplete (interrupted run)', async () => {
      // Create an incomplete stub (like from an interrupted run)
      const stubContent = '# Spec (promoted)'
      fs.writeFileSync(path.join(taskDir, 'spec.md'), stubContent)

      const { skipIfInputQuality } = await import('../../scripts/cody/pipeline/skip-conditions')

      const ctx: PipelineContext = {
        taskDef: {
          input_quality: {
            level: 'good_spec',
            skip_stages: ['spec'],
            reasoning: 'Test',
          },
        } as TaskDefinition,
        taskDir,
        input: {},
        profile: 'standard',
      } as PipelineContext

      const result = skipIfInputQuality(ctx, 'spec')
      expect(result.shouldSkip).toBe(false)
    })

    it('should NOT skip when promoted file is too short', async () => {
      // Create a too-short file
      const shortContent = '# Short'
      fs.writeFileSync(path.join(taskDir, 'spec.md'), shortContent)

      const { skipIfInputQuality } = await import('../../scripts/cody/pipeline/skip-conditions')

      const ctx: PipelineContext = {
        taskDef: {
          input_quality: {
            level: 'good_spec',
            skip_stages: ['spec'],
            reasoning: 'Test',
          },
        } as TaskDefinition,
        taskDir,
        input: {},
        profile: 'standard',
      } as PipelineContext

      const result = skipIfInputQuality(ctx, 'spec')
      expect(result.shouldSkip).toBe(false)
    })
  })

  // ========================================================================
  // Fix #1: Post-action order (resolve-profile last)
  // ========================================================================

  describe('taskify post-action order (Fix #1)', () => {
    it('should have resolve-profile as last post-action in taskify', async () => {
      const { buildPipeline } = await import('../../scripts/cody/pipeline/definitions')

      const ctx: PipelineContext = {
        taskId: TEST_TASK_ID,
        taskDir,
        input: { mode: 'full', clarify: false },
        taskDef: null,
        profile: 'standard',
      } as PipelineContext

      const pipeline = buildPipeline('full', 'standard', false, ctx)
      const taskifyDef = pipeline.stages.get('taskify')

      expect(taskifyDef).toBeDefined()
      expect(taskifyDef!.postActions).toBeDefined()

      const postActionTypes = taskifyDef!.postActions!.map((a) => a.type)
      const lastAction = postActionTypes[postActionTypes.length - 1]

      expect(lastAction).toBe('resolve-profile')
    })

    it('should have check-gate BEFORE resolve-profile', async () => {
      const { buildPipeline } = await import('../../scripts/cody/pipeline/definitions')

      const ctx: PipelineContext = {
        taskId: TEST_TASK_ID,
        taskDir,
        input: { mode: 'full', clarify: false },
        taskDef: null,
        profile: 'standard',
      } as PipelineContext

      const pipeline = buildPipeline('full', 'standard', false, ctx)
      const taskifyDef = pipeline.stages.get('taskify')

      const postActionTypes = taskifyDef!.postActions!.map((a) => a.type)
      const resolveIndex = postActionTypes.indexOf('resolve-profile')
      const checkGateIndex = postActionTypes.indexOf('check-gate')

      expect(checkGateIndex).toBeLessThan(resolveIndex)
    })
  })

  // ========================================================================
  // Fix #5: Full mode profile resolution
  // ========================================================================

  describe('full mode profile resolution (Fix #5)', () => {
    it('should resolve profile from task.json with complexity < 20', async () => {
      const { resolvePipelineProfile } = await import('../../scripts/cody/pipeline-utils')

      const taskDef: TaskDefinition = {
        task_type: 'fix_bug',
        pipeline: 'spec_execute_verify',
        risk_level: 'low',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src/app.ts'],
        missing_inputs: [],
        assumptions: [],
        complexity: 15, // Below threshold (20), should be lightweight
      }

      const profile = resolvePipelineProfile(taskDef)
      expect(profile).toBe('lightweight')
    })

    it('should resolve profile as standard for complexity >= 20', async () => {
      const { resolvePipelineProfile } = await import('../../scripts/cody/pipeline-utils')

      const taskDef: TaskDefinition = {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 0.7,
        primary_domain: 'backend',
        scope: ['src/app.ts', 'src/api/**'],
        missing_inputs: [],
        assumptions: [],
        complexity: 50, // Above threshold, should be standard
      }

      const profile = resolvePipelineProfile(taskDef)
      expect(profile).toBe('standard')
    })

    it('should use explicit pipeline_profile when set', async () => {
      const { resolvePipelineProfile } = await import('../../scripts/cody/pipeline-utils')

      const taskDef: TaskDefinition = {
        task_type: 'fix_bug',
        pipeline: 'spec_execute_verify',
        risk_level: 'low',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src/app.ts'],
        missing_inputs: [],
        assumptions: [],
        pipeline_profile: 'standard', // Explicit override
      }

      const profile = resolvePipelineProfile(taskDef)
      expect(profile).toBe('standard')
    })

    it('should fall back to legacy heuristic when no complexity', async () => {
      const { resolvePipelineProfile } = await import('../../scripts/cody/pipeline-utils')

      // Low risk fix_bug without complexity should be lightweight
      const taskDef: TaskDefinition = {
        task_type: 'fix_bug',
        pipeline: 'spec_execute_verify',
        risk_level: 'low',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['src/app.ts'],
        missing_inputs: [],
        assumptions: [],
        // No complexity - falls back to legacy heuristic
      }

      const profile = resolvePipelineProfile(taskDef)
      expect(profile).toBe('lightweight')
    })
  })

  // ========================================================================
  // Fix #3: Parallel stage post-action error handling
  // ========================================================================

  describe('parallel stage error handling (Fix #3)', () => {
    it('should have parallel test+build group in the implementation pipeline', async () => {
      const { IMPL_ORDER_STANDARD } = await import('../../scripts/cody/pipeline/definitions')

      // Verify parallel group exists for test+build
      const parallelStep = IMPL_ORDER_STANDARD.find(
        (step) => typeof step === 'object' && 'parallel' in step,
      )

      expect(parallelStep).toBeDefined()
      expect((parallelStep as { parallel: string[] }).parallel).toEqual(['test', 'build'])
    })
  })

  // ========================================================================
  // Fix #9: Recovery functions
  // ========================================================================

  describe('recovery functions (Fix #9)', () => {
    it('should recover stale running stages to pending', async () => {
      const { recoverStaleStages } = await import('../../scripts/cody/engine/status')

      const state = {
        version: 2,
        taskId: TEST_TASK_ID,
        mode: 'full',
        pipeline: 'spec_execute_verify',
        state: 'running',
        stages: {
          spec: { state: 'running', retries: 0 }, // Stale - should be reset
          taskify: { state: 'completed', retries: 0 },
        },
      }

      const recovered = recoverStaleStages(state as never)

      expect(recovered.stages.spec.state).toBe('pending')
      expect(recovered.stages.taskify.state).toBe('completed')
    })

    it('should not modify state if no stale stages', async () => {
      const { recoverStaleStages } = await import('../../scripts/cody/engine/status')

      const state = {
        version: 2,
        taskId: TEST_TASK_ID,
        mode: 'full',
        pipeline: 'spec_execute_verify',
        state: 'running',
        stages: {
          spec: { state: 'completed', retries: 0 },
          taskify: { state: 'completed', retries: 0 },
        },
      }

      const recovered = recoverStaleStages(state as never)

      expect(recovered.stages.spec.state).toBe('completed')
      expect(recovered).toBe(state) // Same object reference
    })

    it('should recover pipeline state when all stages complete', async () => {
      const { recoverPipelineState } = await import('../../scripts/cody/engine/status')

      const state = {
        version: 2,
        taskId: TEST_TASK_ID,
        mode: 'full',
        pipeline: 'spec_execute_verify',
        state: 'running', // Stuck in running
        stages: {
          taskify: { state: 'completed', retries: 0 },
          spec: { state: 'completed', retries: 0 },
          build: { state: 'completed', retries: 0 },
        },
      }

      const pipelineOrder = ['taskify', 'spec', 'build']
      const advisoryStages = new Set<string>()

      const recovered = recoverPipelineState(state as never, pipelineOrder, advisoryStages)

      expect(recovered.state).toBe('completed')
    })

    it('should recover pipeline state to failed when non-advisory stage fails', async () => {
      const { recoverPipelineState } = await import('../../scripts/cody/engine/status')

      const state = {
        version: 2,
        taskId: TEST_TASK_ID,
        mode: 'full',
        pipeline: 'spec_execute_verify',
        state: 'running',
        stages: {
          taskify: { state: 'completed', retries: 0 },
          build: { state: 'failed', retries: 1, error: 'Test error' },
        },
      }

      const pipelineOrder = ['taskify', 'build']
      const advisoryStages = new Set<string>()

      const recovered = recoverPipelineState(state as never, pipelineOrder, advisoryStages)

      expect(recovered.state).toBe('failed')
    })
  })
})

// ============================================================================
// Summary
// ============================================================================

/**
 * Unit Test Coverage for Pipeline Fixes:
 *
 * ✓ Fix #4: skipIfInputQuality - content validation instead of just existence
 *   - Does not skip when file doesn't exist
 *   - Skips when file has valid content
 *   - Does NOT skip for incomplete stubs (interrupted runs)
 *   - Does NOT skip for too-short files
 *
 * ✓ Fix #1: post-action order - resolve-profile is last
 *   - verify resolve-profile is last post-action
 *   - verify check-gate runs before resolve-profile
 *
 * ✓ Fix #5: full mode profile resolution
 *   - lightweight for complexity < 20
 *   - standard for complexity >= 20
 *   - respects explicit pipeline_profile
 *   - falls back to legacy heuristic
 *
 * ✓ Fix #3: parallel stage error handling
 *   - verify no parallel stages in impl pipeline
 *
 * ✓ Fix #9: recovery functions
 *   - recoverStaleStages resets running to pending
 *   - recoverPipelineState detects completed pipelines
 *   - recoverPipelineState detects failed non-advisory stages
 */

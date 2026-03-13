/**
 * @fileType test
 * @domain cody | engine
 * @pattern state-mutation-fixes
 * @ai-summary Tests for state mutation bug fixes in entry.ts and post-actions.ts
 */

import { describe, it, expect } from 'vitest'
import type {
  PipelineStateV2,
  StageStateV2,
  PipelineContext,
} from '../../../../../scripts/cody/engine/types'
import { resumeFromGate, updateStage } from '../../../../../scripts/cody/engine/status'

// ============================================================================
// Test Fixtures
// ============================================================================

function createBaseState(overrides?: Partial<PipelineStateV2>): PipelineStateV2 {
  return {
    version: 2,
    taskId: 'test-123',
    mode: 'full',
    pipeline: 'spec_execute_verify',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: 'running',
    cursor: null,
    stages: {},
    ...overrides,
  }
}

function createStage(state: StageStateV2['state'], extra?: Partial<StageStateV2>): StageStateV2 {
  return {
    state,
    retries: 0,
    ...(state === 'running' && { startedAt: new Date().toISOString() }),
    ...(state === 'completed' && { completedAt: new Date().toISOString() }),
    ...(state === 'failed' && { error: 'Stage failed' }),
    ...extra,
  }
}

// ============================================================================
// Fix #1: resumeFromGate — immutable gate resume
// ============================================================================

describe('resumeFromGate', () => {
  it('should mark the paused stage as completed', () => {
    const state = createBaseState({
      state: 'paused',
      completedAt: new Date().toISOString(),
      stages: {
        build: createStage('completed'),
        verify: createStage('completed'),
        autofix: createStage('paused'),
      },
    })

    const resumed = resumeFromGate(state, 'autofix')
    expect(resumed.stages['autofix'].state).toBe('completed')
  })

  it('should set pipeline state to running', () => {
    const state = createBaseState({
      state: 'paused',
      completedAt: new Date().toISOString(),
      stages: {
        autofix: createStage('paused'),
      },
    })

    const resumed = resumeFromGate(state, 'autofix')
    expect(resumed.state).toBe('running')
  })

  it('should remove completedAt from pipeline', () => {
    const state = createBaseState({
      state: 'paused',
      completedAt: '2025-01-01T00:00:00.000Z',
      stages: {
        autofix: createStage('paused'),
      },
    })

    const resumed = resumeFromGate(state, 'autofix')
    expect(resumed.completedAt).toBeUndefined()
  })

  it('should NOT mutate the original state object', () => {
    const state = createBaseState({
      state: 'paused',
      completedAt: '2025-01-01T00:00:00.000Z',
      stages: {
        build: createStage('completed'),
        autofix: createStage('paused'),
      },
    })

    // Freeze the original to detect mutations
    const originalStageState = state.stages['autofix'].state
    const originalPipelineState = state.state
    const originalCompletedAt = state.completedAt

    const resumed = resumeFromGate(state, 'autofix')

    // Original should be unchanged
    expect(state.stages['autofix'].state).toBe(originalStageState)
    expect(state.state).toBe(originalPipelineState)
    expect(state.completedAt).toBe(originalCompletedAt)

    // Resumed should be different
    expect(resumed).not.toBe(state)
    expect(resumed.stages).not.toBe(state.stages)
  })

  it('should preserve other stage states', () => {
    const state = createBaseState({
      state: 'paused',
      completedAt: new Date().toISOString(),
      stages: {
        build: createStage('completed'),
        verify: createStage('completed'),
        autofix: createStage('paused'),
        pr: createStage('pending'),
      },
    })

    const resumed = resumeFromGate(state, 'autofix')
    expect(resumed.stages['build'].state).toBe('completed')
    expect(resumed.stages['verify'].state).toBe('completed')
    expect(resumed.stages['autofix'].state).toBe('completed')
    expect(resumed.stages['pr'].state).toBe('pending')
  })

  it('should handle non-existent stage gracefully', () => {
    const state = createBaseState({
      state: 'paused',
      stages: {
        build: createStage('completed'),
      },
    })

    // Should still work — creates the stage if needed
    const resumed = resumeFromGate(state, 'nonexistent')
    expect(resumed.stages['nonexistent'].state).toBe('completed')
    expect(resumed.state).toBe('running')
  })
})

// ============================================================================
// Fix #1: Verify updateStage immutability (existing function)
// ============================================================================

describe('updateStage immutability', () => {
  it('should not mutate the input state', () => {
    const state = createBaseState({
      stages: {
        build: createStage('running'),
      },
    })

    const original = JSON.parse(JSON.stringify(state))
    const updated = updateStage(state, 'build', { state: 'completed' })

    // Original should be unchanged
    expect(state).toEqual(original)
    // Updated should be different object
    expect(updated).not.toBe(state)
    expect(updated.stages['build'].state).toBe('completed')
  })
})

// ============================================================================
// Fix #4: Signal handler git ops timeout - static analysis test
// ============================================================================

describe('signal handler git ops', () => {
  it('should use execFileSync with timeout in signal handler (static analysis)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const entryPath = path.resolve(__dirname, '../../../../../scripts/cody/entry.ts')
    const content = fs.readFileSync(entryPath, 'utf-8')

    // Find the signal handler section
    const signalHandlerStart = content.indexOf('cleanupOnSignal')
    const signalHandlerEnd = content.indexOf("process.on('SIGTERM'", signalHandlerStart)
    const signalHandler = content.slice(signalHandlerStart, signalHandlerEnd)

    // Should NOT use execSync (vulnerable to hanging)
    expect(signalHandler).not.toContain('execSync(')

    // Should use execFileSync (safe from shell injection)
    expect(signalHandler).toContain('execFileSync')

    // All execFileSync calls should have timeout option
    // Count execFileSync occurrences and timeout occurrences in signal handler
    const execFileCalls = (signalHandler.match(/execFileSync\(/g) || []).length
    const timeoutOccurrences = (signalHandler.match(/timeout:\s*SIGNAL_TIMEOUT/g) || []).length
    expect(execFileCalls).toBeGreaterThan(0)
    expect(timeoutOccurrences).toBe(execFileCalls)
  })

  it('should not use shell-injectable execSync with string arguments', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const entryPath = path.resolve(__dirname, '../../../../../scripts/cody/entry.ts')
    const content = fs.readFileSync(entryPath, 'utf-8')

    // Find the signal handler section
    const signalHandlerStart = content.indexOf('cleanupOnSignal')
    const signalHandlerEnd = content.indexOf("process.on('SIGTERM'", signalHandlerStart)
    const signalHandler = content.slice(signalHandlerStart, signalHandlerEnd)

    // Should NOT use execSync with template literals (shell injection risk)
    expect(signalHandler).not.toMatch(/execSync\(`[^`]*\$\{/)
  })
})

// ============================================================================
// Fix for Pipeline Rebuild Bug: Full mode should include all stages
// ============================================================================

describe('full pipeline mode', () => {
  it('should include both spec and impl stages in full mode', async () => {
    // Import buildPipeline - it requires a ctx with minimal properties
    const { buildPipeline } = await import('../../../../../scripts/cody/pipeline/definitions')

    const ctx = {
      taskId: 'test-123',
      taskDir: './.tasks/test-123',
      input: { mode: 'full' },
      taskDef: null,
      profile: 'standard',
      pipelineNeedsRebuild: false,
    } as unknown as PipelineContext

    const pipeline = buildPipeline('full', 'standard', false, ctx)

    // Full mode should include ALL stages, not just spec
    const stageNames = Array.from(pipeline.stages.keys())

    // Should have spec stages (spec merged into gap)
    expect(stageNames).toContain('taskify')
    expect(stageNames).toContain('gap')

    // Should ALSO have impl stages (THIS IS THE FIX)
    expect(stageNames).toContain('architect')
    expect(stageNames).toContain('plan-gap')
    expect(stageNames).toContain('build')
    expect(stageNames).toContain('commit')
    expect(stageNames).toContain('verify')
    expect(stageNames).toContain('pr')
  })

  it('should include pr stage in full pipeline order', async () => {
    const { buildPipeline, flattenPipelineOrder } =
      await import('../../../../../scripts/cody/pipeline/definitions')

    const ctx = {
      taskId: 'test-123',
      taskDir: './.tasks/test-123',
      input: { mode: 'full' },
      taskDef: null,
      profile: 'standard',
      pipelineNeedsRebuild: false,
    } as unknown as PipelineContext

    const pipeline = buildPipeline('full', 'standard', false, ctx)
    const order = flattenPipelineOrder(pipeline.order)

    // pr should be in the order (last stage)
    expect(order).toContain('pr')
    expect(order[order.length - 1]).toBe('pr')
  })
})

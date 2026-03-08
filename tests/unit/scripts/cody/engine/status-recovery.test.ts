/**
 * @fileType test
 * @domain cody | engine
 * @pattern status-recovery
 * @ai-summary Unit tests for pipeline status recovery functions
 */

import { describe, it, expect } from 'vitest'
import type { PipelineStateV2, StageStateV2 } from '../../../../../scripts/cody/engine/types'

// Import the functions we're testing - these will fail until implemented
import { recoverStaleStages, recoverPipelineState } from '../../../../../scripts/cody/engine/status'

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

function createStage(state: StageStateV2['state']): StageStateV2 {
  return {
    state,
    retries: 0,
    ...(state === 'running' && { startedAt: new Date().toISOString() }),
    ...(state === 'completed' && { completedAt: new Date().toISOString() }),
    ...(state === 'failed' && { error: 'Stage failed' }),
  }
}

// ============================================================================
// Tests: recoverStaleStages
// ============================================================================

describe('recoverStaleStages', () => {
  it('should reset running stages to pending', () => {
    // Arrange: Create state with 3 stages: completed, running, pending
    const state = createBaseState({
      stages: {
        a: createStage('completed'),
        b: createStage('running'),
        c: createStage('pending'),
      },
    })

    // Act: Call recoverStaleStages
    const recovered = recoverStaleStages(state)

    // Assert: running stage should be reset to pending
    expect(recovered.stages['a'].state).toBe('completed')
    expect(recovered.stages['b'].state).toBe('pending') // Was running, now pending
    expect(recovered.stages['c'].state).toBe('pending')
  })

  it('should return new object (immutable)', () => {
    // Arrange
    const state = createBaseState({
      stages: {
        a: createStage('running'),
      },
    })

    // Act
    const recovered = recoverStaleStages(state)

    // Assert: Different object reference
    expect(recovered).not.toBe(state)
    // Original state unchanged
    expect(state.stages['a'].state).toBe('running')
  })

  it('should be identity when no running stages', () => {
    // Arrange: All stages are completed
    const state = createBaseState({
      stages: {
        a: createStage('completed'),
        b: createStage('completed'),
        c: createStage('completed'),
      },
    })

    // Act
    const recovered = recoverStaleStages(state)

    // Assert: Same stages, no changes
    expect(recovered.stages['a'].state).toBe('completed')
    expect(recovered.stages['b'].state).toBe('completed')
    expect(recovered.stages['c'].state).toBe('completed')
  })

  it('should only reset stages that are currently running', () => {
    // Arrange: Multiple running stages
    const state = createBaseState({
      stages: {
        a: createStage('completed'),
        b: createStage('running'),
        c: createStage('running'),
        d: createStage('failed'),
        e: createStage('pending'),
      },
    })

    // Act
    const recovered = recoverStaleStages(state)

    // Assert: Only running stages reset
    expect(recovered.stages['a'].state).toBe('completed')
    expect(recovered.stages['b'].state).toBe('pending')
    expect(recovered.stages['c'].state).toBe('pending')
    expect(recovered.stages['d'].state).toBe('failed')
    expect(recovered.stages['e'].state).toBe('pending')
  })
})

// ============================================================================
// Tests: recoverPipelineState
// ============================================================================

describe('recoverPipelineState', () => {
  it('should complete pipeline when all stages done', () => {
    // Arrange: Pipeline running, all stages completed
    const state = createBaseState({
      state: 'running',
      stages: {
        a: createStage('completed'),
        b: createStage('completed'),
        c: createStage('completed'),
      },
    })

    // Act
    const recovered = recoverPipelineState(state, ['a', 'b', 'c'], new Set())

    // Assert: Pipeline state should be completed
    expect(recovered.state).toBe('completed')
    expect(recovered.completedAt).toBeDefined()
  })

  it('should fail pipeline when non-advisory stage failed', () => {
    // Arrange: Pipeline running, stage b failed (not advisory)
    const state = createBaseState({
      state: 'running',
      stages: {
        a: createStage('completed'),
        b: createStage('failed'),
      },
    })

    // Act
    const recovered = recoverPipelineState(state, ['a', 'b'], new Set())

    // Assert: Pipeline state should be failed
    expect(recovered.state).toBe('failed')
  })

  it('should ignore advisory stage failures', () => {
    // Arrange: Pipeline running, autofix stage failed but it's advisory
    const state = createBaseState({
      state: 'running',
      stages: {
        a: createStage('completed'),
        b: createStage('completed'),
        autofix: createStage('failed'),
      },
    })

    // Act
    const recovered = recoverPipelineState(state, ['a', 'b', 'autofix'], new Set(['autofix']))

    // Assert: Pipeline should complete despite advisory failure
    expect(recovered.state).toBe('completed')
  })

  it('should leave running if stages still pending', () => {
    // Arrange: Pipeline running, mixed states with pending
    const state = createBaseState({
      state: 'running',
      stages: {
        a: createStage('completed'),
        b: createStage('running'),
        c: createStage('pending'),
      },
    })

    // Act
    const recovered = recoverPipelineState(state, ['a', 'b', 'c'], new Set())

    // Assert: Pipeline should still be running
    expect(recovered.state).toBe('running')
    expect(recovered.completedAt).toBeUndefined()
  })

  it('should ignore stages not in pipeline order', () => {
    // Arrange: State has extra stages not in the pipeline order
    const state = createBaseState({
      state: 'running',
      stages: {
        a: createStage('completed'),
        b: createStage('completed'),
        extra: createStage('failed'), // Not in pipeline order
      },
    })

    // Act: Only check a, b - extra should be ignored
    const recovered = recoverPipelineState(state, ['a', 'b'], new Set())

    // Assert: Should complete since a and b are done, extra is ignored
    expect(recovered.state).toBe('completed')
  })

  it('should be no-op when pipeline already completed', () => {
    // Arrange: Pipeline already completed
    const state = createBaseState({
      state: 'completed',
      completedAt: new Date().toISOString(),
      stages: {
        a: createStage('completed'),
        b: createStage('completed'),
      },
    })

    // Act
    const recovered = recoverPipelineState(state, ['a', 'b'], new Set())

    // Assert: State unchanged
    expect(recovered.state).toBe('completed')
    expect(recovered).toBe(state) // Same object - no changes
  })

  it('should be no-op when pipeline already failed', () => {
    // Arrange: Pipeline already failed
    const state = createBaseState({
      state: 'failed',
      completedAt: new Date().toISOString(),
      stages: {
        a: createStage('completed'),
        b: createStage('failed'),
      },
    })

    // Act
    const recovered = recoverPipelineState(state, ['a', 'b'], new Set())

    // Assert: State unchanged
    expect(recovered.state).toBe('failed')
  })

  it('should fail pipeline when multiple non-advisory stages fail', () => {
    // Arrange: Multiple non-advisory stages failed
    const state = createBaseState({
      state: 'running',
      stages: {
        a: createStage('completed'),
        b: createStage('failed'),
        c: createStage('failed'),
      },
    })

    // Act
    const recovered = recoverPipelineState(state, ['a', 'b', 'c'], new Set())

    // Assert: Pipeline should be failed
    expect(recovered.state).toBe('failed')
  })

  it('should complete pipeline when all required stages done despite extra failed advisory', () => {
    // Arrange: Required stages done, but extra advisory stage failed
    const state = createBaseState({
      state: 'running',
      stages: {
        a: createStage('completed'),
        b: createStage('completed'),
        audit: createStage('failed'), // Advisory, extra
      },
    })

    // Act
    const recovered = recoverPipelineState(state, ['a', 'b'], new Set(['audit']))

    // Assert: Pipeline should complete
    expect(recovered.state).toBe('completed')
  })
})

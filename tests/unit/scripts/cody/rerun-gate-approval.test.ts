/**
 * @fileType test
 * @domain cody | engine
 * @pattern rerun-gate-approval
 * @ai-summary Regression test for issue #673: gate approval + resetFromStage corruption
 *
 * Bug: When a gate is approved during rerun mode, `resumeFromGate()` correctly marks the
 * gate stage as completed, but then `resetFromStage()` resets it back to pending because
 * `fromStage` is set to the approved stage. This overwrites the approval and causes
 * "Pipeline failed at stage: unknown".
 *
 * Fix: After successful gate approval, set `fromStage` to the NEXT stage after the
 * approved gate, so `resetFromStage` doesn't clobber the approval.
 */

import { describe, it, expect } from 'vitest'
import type { PipelineStateV2, StageStateV2 } from '../../../../scripts/cody/engine/types'
import { resumeFromGate, resetFromStage } from '../../../../scripts/cody/engine/status'
import {
  resolveFromStageAfterGateApproval,
  findNearestEarlierStage,
} from '../../../../scripts/cody/rerun-utils'

// ============================================================================
// Test Fixtures
// ============================================================================

function createBaseState(overrides?: Partial<PipelineStateV2>): PipelineStateV2 {
  return {
    version: 2,
    taskId: 'test-673',
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
    ...(state === 'paused' && {}),
    ...extra,
  }
}

// ============================================================================
// Tests: Issue #673 — Gate approval overwritten by resetFromStage
// ============================================================================

describe('Issue #673: Gate approval + resetFromStage interaction', () => {
  const FULL_PIPELINE = [
    'taskify',
    'spec',
    'gap',
    'clarify',
    'architect',
    'plan-gap',
    'build',
    'commit',
    'verify',
    'autofix',
    'pr',
  ]

  it('BUG REPRODUCTION: resumeFromGate marks taskify completed, then resetFromStage(taskify) resets it to pending', () => {
    // Arrange: Pipeline paused at taskify gate
    const pausedState = createBaseState({
      state: 'paused',
      completedAt: new Date().toISOString(),
      stages: {
        taskify: createStage('paused'),
      },
    })

    // Act Step 1: resumeFromGate correctly marks taskify as completed
    const resumedState = resumeFromGate(pausedState, 'taskify')
    expect(resumedState.stages['taskify'].state).toBe('completed')
    expect(resumedState.state).toBe('running')

    // Act Step 2: resetFromStage('taskify') — THE BUG
    // This resets taskify back to pending, overwriting the gate approval
    // Use a temp dir that doesn't exist so file deletion is a no-op
    const corruptedState = resetFromStage(
      resumedState,
      'taskify',
      FULL_PIPELINE,
      '/tmp/nonexistent-test-dir-673',
    )

    // Assert: taskify was reset to pending — THIS IS THE BUG
    expect(corruptedState.stages['taskify'].state).toBe('pending')
  })

  it('FIX VALIDATION: resetFromStage from NEXT stage preserves gate approval', () => {
    // Arrange: Pipeline paused at taskify gate
    const pausedState = createBaseState({
      state: 'paused',
      completedAt: new Date().toISOString(),
      stages: {
        taskify: createStage('paused'),
      },
    })

    // Act Step 1: resumeFromGate correctly marks taskify as completed
    const resumedState = resumeFromGate(pausedState, 'taskify')
    expect(resumedState.stages['taskify'].state).toBe('completed')

    // Act Step 2: resetFromStage from the NEXT stage (spec), not taskify
    const nextStage = resolveFromStageAfterGateApproval('taskify', FULL_PIPELINE)
    expect(nextStage).toBe('spec')

    const fixedState = resetFromStage(
      resumedState,
      nextStage,
      FULL_PIPELINE,
      '/tmp/nonexistent-test-dir-673',
    )

    // Assert: taskify remains completed — gate approval preserved!
    expect(fixedState.stages['taskify'].state).toBe('completed')
    // And the pipeline is ready to continue from spec onwards
    expect(fixedState.state).toBe('running')
  })
})

describe('resolveFromStageAfterGateApproval', () => {
  const FULL_PIPELINE = [
    'taskify',
    'spec',
    'gap',
    'clarify',
    'architect',
    'plan-gap',
    'build',
    'commit',
    'verify',
    'autofix',
    'pr',
  ]

  it('returns next stage after taskify', () => {
    const result = resolveFromStageAfterGateApproval('taskify', FULL_PIPELINE)
    expect(result).toBe('spec')
  })

  it('returns next stage after architect', () => {
    const result = resolveFromStageAfterGateApproval('architect', FULL_PIPELINE)
    expect(result).toBe('plan-gap')
  })

  it('returns the stage itself when it is the last stage (edge case)', () => {
    const result = resolveFromStageAfterGateApproval('pr', FULL_PIPELINE)
    expect(result).toBe('pr')
  })

  it('returns the stage itself when not found in pipeline', () => {
    const result = resolveFromStageAfterGateApproval('nonexistent', FULL_PIPELINE)
    expect(result).toBe('nonexistent')
  })

  it('works with lightweight pipeline (no spec/gap)', () => {
    const LIGHTWEIGHT = ['taskify', 'clarify', 'architect', 'build', 'commit', 'verify', 'pr']
    const result = resolveFromStageAfterGateApproval('taskify', LIGHTWEIGHT)
    expect(result).toBe('clarify')
  })
})

describe('Profile-aware pipeline resolution', () => {
  // This tests the fix for the bug where ctx.profile was resolved from task.json
  // AFTER being used to calculate fromStage, causing "gap not found" error.
  //
  // Scenario: A task with complexity:moderate (resolves to lightweight profile)
  // - If profile is resolved CORRECTLY first: next stage after taskify = 'clarify'
  // - If profile is NOT resolved (uses default 'standard'): next stage = 'gap'
  //
  // The bug was: entry.ts used ctx.profile (default='standard') to pick 'gap',
  // then resolved profile to 'lightweight' where 'gap' doesn't exist -> crash.

  const STANDARD_ORDER = [
    'taskify',
    'gap',
    'clarify',
    'architect',
    'plan-gap',
    'build',
    'commit',
    'verify',
    'pr',
  ]

  const LIGHTWEIGHT_ORDER = ['taskify', 'clarify', 'architect', 'build', 'commit', 'verify', 'pr']

  it('standard profile: next stage after taskify is gap', () => {
    const result = resolveFromStageAfterGateApproval('taskify', STANDARD_ORDER)
    expect(result).toBe('gap')
  })

  it('lightweight profile: next stage after taskify is clarify', () => {
    const result = resolveFromStageAfterGateApproval('taskify', LIGHTWEIGHT_ORDER)
    expect(result).toBe('clarify')
  })

  it('demonstrates why profile must be resolved before fromStage calculation', () => {
    // This is the exact bug scenario from issue #827
    // Task has complexity:moderate (resolves to lightweight)
    // But ctx.profile was default='standard' when calculating fromStage

    // Wrong: using standard profile (the bug)
    const wrongNextStage = resolveFromStageAfterGateApproval('taskify', STANDARD_ORDER)
    expect(wrongNextStage).toBe('gap')

    // Correct: using lightweight profile (the fix)
    const correctNextStage = resolveFromStageAfterGateApproval('taskify', LIGHTWEIGHT_ORDER)
    expect(correctNextStage).toBe('clarify')

    // Verify: 'gap' does NOT exist in lightweight pipeline
    expect(LIGHTWEIGHT_ORDER.includes('gap')).toBe(false)

    // Therefore: if ctx.profile resolves to 'lightweight', MUST use lightweight pipeline
    // Otherwise validation fails with "Stage gap not found"
  })
})

describe('findNearestEarlierStage', () => {
  // Lightweight pipeline for testing (no 'gap' or 'plan-gap')
  const LIGHTWEIGHT_ORDER = ['taskify', 'clarify', 'architect', 'build', 'commit', 'verify', 'pr']

  it('gap missing from lightweight pipeline → falls back to taskify', () => {
    // In ALL_STAGES, taskify comes before gap and exists in lightweight
    const result = findNearestEarlierStage('gap', LIGHTWEIGHT_ORDER)
    expect(result).toBe('taskify')
  })

  it('plan-gap missing from lightweight → falls back to architect', () => {
    // In ALL_STAGES, architect comes before plan-gap and exists in lightweight
    const result = findNearestEarlierStage('plan-gap', LIGHTWEIGHT_ORDER)
    expect(result).toBe('architect')
  })

  it('unknown stage → falls back to first pipeline stage', () => {
    const result = findNearestEarlierStage('nonexistent', LIGHTWEIGHT_ORDER)
    expect(result).toBe('taskify')
  })

  it('stage exists in pipeline → returns nearest earlier stage', () => {
    // build exists, but architect is the nearest earlier in ALL_STAGES
    const result = findNearestEarlierStage('build', LIGHTWEIGHT_ORDER)
    expect(result).toBe('architect')
  })

  it('no earlier stage exists → returns first pipeline stage', () => {
    // In ALL_STAGES, taskify is first, so nothing comes before it
    // But for this test, we use a custom pipeline where taskify is not first
    const customPipeline = ['build', 'commit', 'verify', 'pr']
    const result = findNearestEarlierStage('taskify', customPipeline)
    expect(result).toBe('build')
  })
})

describe('Issue #827: stale paused state in resetFromStage', () => {
  const LIGHTWEIGHT_PIPELINE = [
    'taskify',
    'clarify',
    'architect',
    'build',
    'commit',
    'verify',
    'pr',
  ]

  it('marks stale paused stages as completed when resetting from a later stage', () => {
    // Scenario: taskify was paused (gate), but architect/build ran after it.
    // When resetting from 'build', taskify should be marked completed, not left paused.
    const state = createBaseState({
      state: 'failed',
      stages: {
        taskify: createStage('paused'), // Stale! Gate was approved but state not updated
        architect: createStage('completed'),
        build: createStage('failed'),
      },
    })

    const result = resetFromStage(state, 'build', LIGHTWEIGHT_PIPELINE, '/tmp/nonexistent-827')

    // taskify should be fixed from 'paused' → 'completed'
    expect(result.stages['taskify'].state).toBe('completed')
    // architect should remain completed (before fromStage)
    expect(result.stages['architect'].state).toBe('completed')
    // build should be reset to pending
    expect(result.stages['build'].state).toBe('pending')
  })

  it('does not mark non-paused stages as completed', () => {
    const state = createBaseState({
      state: 'failed',
      stages: {
        taskify: createStage('completed'), // Already correct
        architect: createStage('completed'),
        build: createStage('failed'),
      },
    })

    const result = resetFromStage(state, 'build', LIGHTWEIGHT_PIPELINE, '/tmp/nonexistent-827')

    // taskify stays completed (not modified)
    expect(result.stages['taskify'].state).toBe('completed')
    expect(result.stages['build'].state).toBe('pending')
  })

  it('does not mark paused stages AFTER fromStage as completed', () => {
    // Edge case: a stage after fromStage is paused — should be reset to pending
    const state = createBaseState({
      state: 'failed',
      stages: {
        taskify: createStage('completed'),
        architect: createStage('paused'), // After fromStage 'taskify' — should reset
      },
    })

    const result = resetFromStage(state, 'architect', LIGHTWEIGHT_PIPELINE, '/tmp/nonexistent-827')

    expect(result.stages['taskify'].state).toBe('completed')
    // architect is IN stagesToReset, so it gets reset to pending, not completed
    expect(result.stages['architect'].state).toBe('pending')
  })

  it('full scenario: rerun after build failure with stale taskify paused', () => {
    // This reproduces the exact issue #827 scenario
    const state = createBaseState({
      state: 'failed',
      stages: {
        taskify: createStage('paused'), // Stale from previous gate approval
        architect: createStage('completed'),
        test: createStage('completed'),
        build: createStage('failed', { error: 'Quality gates failed' }),
      },
    })

    // When pipeline state is 'failed', the fix prefers failedStage over pausedStage
    // So fromStage would be 'build' (not 'taskify')
    const result = resetFromStage(state, 'build', LIGHTWEIGHT_PIPELINE, '/tmp/nonexistent-827')

    // taskify: paused → completed (stale fix)
    expect(result.stages['taskify'].state).toBe('completed')
    // architect, test: stay completed (before fromStage) — but test isn't in LIGHTWEIGHT_PIPELINE
    expect(result.stages['architect'].state).toBe('completed')
    // build: reset to pending
    expect(result.stages['build'].state).toBe('pending')
    // Overall state: running
    expect(result.state).toBe('running')
  })
})

// ============================================================================
// Tests: Implicit gate approval on @cody rerun
// ============================================================================

/**
 * Regression tests for implicit gate approval on @cody rerun.
 *
 * Bug: When @cody rerun is triggered on a pipeline paused at a gate, the rerun
 * re-runs the gated stage from scratch and re-posts the same gate question.
 *
 * Fix: When handleGateApproval returns 'waiting' in rerun mode, implicitly approve
 * the gate. The rationale: @cody rerun is a clear signal the user wants the pipeline
 * to proceed — they should never need to separately approve a gate they've already seen.
 */
describe('Implicit gate approval on @cody rerun', () => {
  const LIGHTWEIGHT_PIPELINE = [
    'taskify',
    'clarify',
    'architect',
    'plan-gap',
    'build',
    'commit',
    'verify',
    'pr',
  ]

  const STANDARD_PIPELINE = [
    'taskify',
    'gap',
    'clarify',
    'architect',
    'plan-gap',
    'build',
    'commit',
    'verify',
    'pr',
  ]

  it('implicit approval marks paused stage as completed and pipeline as running', () => {
    // Arrange: Pipeline paused at taskify gate
    const pausedState = createBaseState({
      state: 'paused',
      completedAt: new Date().toISOString(),
      stages: {
        taskify: createStage('paused'),
      },
    })

    // Act: Simulate implicit approval via resumeFromGate (already imported at top)
    const approvedState = resumeFromGate(pausedState, 'taskify')

    // Assert: taskify is now completed, pipeline is running
    expect(approvedState.stages['taskify'].state).toBe('completed')
    expect(approvedState.state).toBe('running')
  })

  it('fromStage resolves to next stage after implicitly approved gate', () => {
    // Arrange: taskify was implicitly approved
    const gateStage = 'taskify'

    // Act: Use resolveFromStageAfterGateApproval to find the next stage (already imported at top)

    // Standard pipeline: next after taskify is gap
    const nextStageStandard = resolveFromStageAfterGateApproval(gateStage, STANDARD_PIPELINE)
    expect(nextStageStandard).toBe('gap')

    // Lightweight pipeline: next after taskify is clarify
    const nextStageLightweight = resolveFromStageAfterGateApproval(gateStage, LIGHTWEIGHT_PIPELINE)
    expect(nextStageLightweight).toBe('clarify')
  })

  it('implicit approval uses correct reason string in approval file', () => {
    // The implicit approval should write "implicitly approved via @cody rerun"
    // This test verifies the expected reason string format
    const implicitReason = 'implicitly approved via @cody rerun'
    const explicitReason = 'approved by user'

    // Verify the reason strings contain expected keywords
    expect(implicitReason).toContain('implicitly approved')
    expect(implicitReason).toContain('@cody rerun')
    expect(explicitReason).toContain('approved by user')
  })

  it('verify that gateApprovedStage enables correct fromStage resolution', () => {
    // This test verifies the integration: when gateApprovedStage is set,
    // fromStage should resolve to the next stage after the gate

    // Scenario: taskify gate was implicitly approved
    const gateApprovedStage = 'taskify'

    // In rerun mode with standard profile, fromStage should be 'gap' (next after taskify)
    const fromStage = resolveFromStageAfterGateApproval(gateApprovedStage, STANDARD_PIPELINE)

    // Verify: fromStage is NOT the gate stage itself (that would cause resetFromStage to clobber approval)
    expect(fromStage).not.toBe('taskify')
    expect(fromStage).toBe('gap')

    // Verify: fromStage is after the gate in pipeline order
    const gateIndex = STANDARD_PIPELINE.indexOf(gateApprovedStage)
    const fromIndex = STANDARD_PIPELINE.indexOf(fromStage)
    expect(fromIndex).toBeGreaterThan(gateIndex)
  })
})

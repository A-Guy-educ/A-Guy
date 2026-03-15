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
import { resolveFromStageAfterGateApproval } from '../../../../scripts/cody/rerun-utils'

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

/**
 * @fileType test
 * @domain cody | engine | post-action
 * @ai-summary Tests for PostActionType classification (blocking vs advisory)
 */

import { describe, it, expect } from 'vitest'
import {
  PostActionType,
  BLOCKING_POST_ACTIONS,
  isBlockingPostAction,
} from '../../../../../scripts/cody/engine/types'

describe('PostActionType', () => {
  it('should be a union type with all known post-action types', () => {
    const expectedTypes: PostActionType[] = [
      'validate-task-json',
      'set-classification-labels',
      'resolve-profile',
      'check-gate',
      'commit-task-files',
      'archive-rerun-feedback',
      'validate-plan-exists',
      'validate-build-content',
      'validate-src-changes',
      'run-tsc',
      'run-unit-tests',
      'run-quality-with-autofix',
      'analyze-review-findings',
      'clear-verify-failures',
      'run-mechanical-autofix',
      'parallel',
    ]

    // Verify BLOCKING_POST_ACTIONS only contains valid PostActionType values
    BLOCKING_POST_ACTIONS.forEach((type) => {
      expect(expectedTypes).toContain(type)
    })
  })
})

describe('BLOCKING_POST_ACTIONS', () => {
  it('should include validate-task-json as blocking', () => {
    expect(BLOCKING_POST_ACTIONS).toContain('validate-task-json')
  })

  it('should include resolve-profile as blocking', () => {
    expect(BLOCKING_POST_ACTIONS).toContain('resolve-profile')
  })

  it('should include check-gate as blocking', () => {
    expect(BLOCKING_POST_ACTIONS).toContain('check-gate')
  })

  it('should include commit-task-files as blocking', () => {
    expect(BLOCKING_POST_ACTIONS).toContain('commit-task-files')
  })

  it('should include validate-plan-exists as blocking', () => {
    expect(BLOCKING_POST_ACTIONS).toContain('validate-plan-exists')
  })

  it('should include validate-build-content as blocking', () => {
    expect(BLOCKING_POST_ACTIONS).toContain('validate-build-content')
  })

  it('should include validate-src-changes as blocking', () => {
    expect(BLOCKING_POST_ACTIONS).toContain('validate-src-changes')
  })

  it('should NOT include set-classification-labels as blocking (advisory)', () => {
    expect(BLOCKING_POST_ACTIONS).not.toContain('set-classification-labels')
  })

  it('should NOT include archive-rerun-feedback as blocking (advisory)', () => {
    expect(BLOCKING_POST_ACTIONS).not.toContain('archive-rerun-feedback')
  })

  it('should NOT include run-tsc as blocking (advisory)', () => {
    expect(BLOCKING_POST_ACTIONS).not.toContain('run-tsc')
  })

  it('should NOT include run-unit-tests as blocking (advisory)', () => {
    expect(BLOCKING_POST_ACTIONS).not.toContain('run-unit-tests')
  })

  it('should NOT include run-quality-with-autofix as blocking (advisory)', () => {
    expect(BLOCKING_POST_ACTIONS).not.toContain('run-quality-with-autofix')
  })

  it('should NOT include analyze-review-findings as blocking (advisory)', () => {
    expect(BLOCKING_POST_ACTIONS).not.toContain('analyze-review-findings')
  })

  it('should NOT include clear-verify-failures as blocking (advisory)', () => {
    expect(BLOCKING_POST_ACTIONS).not.toContain('clear-verify-failures')
  })

  it('should NOT include run-mechanical-autofix as blocking (advisory)', () => {
    expect(BLOCKING_POST_ACTIONS).not.toContain('run-mechanical-autofix')
  })

  it('should NOT include parallel as blocking (it delegates to children)', () => {
    expect(BLOCKING_POST_ACTIONS).not.toContain('parallel')
  })
})

describe('isBlockingPostAction', () => {
  it('should return true for validate-task-json', () => {
    expect(isBlockingPostAction({ type: 'validate-task-json' })).toBe(true)
  })

  it('should return true for resolve-profile', () => {
    expect(isBlockingPostAction({ type: 'resolve-profile' })).toBe(true)
  })

  it('should return true for check-gate', () => {
    expect(isBlockingPostAction({ type: 'check-gate', gate: 'quality' })).toBe(true)
  })

  it('should return true for commit-task-files', () => {
    expect(
      isBlockingPostAction({
        type: 'commit-task-files',
        stagingStrategy: 'task-only',
        push: true,
        ensureBranch: true,
      }),
    ).toBe(true)
  })

  it('should return true for validate-plan-exists', () => {
    expect(isBlockingPostAction({ type: 'validate-plan-exists' })).toBe(true)
  })

  it('should return true for validate-build-content', () => {
    expect(isBlockingPostAction({ type: 'validate-build-content' })).toBe(true)
  })

  it('should return true for validate-src-changes', () => {
    expect(isBlockingPostAction({ type: 'validate-src-changes' })).toBe(true)
  })

  it('should return false for set-classification-labels (advisory)', () => {
    expect(isBlockingPostAction({ type: 'set-classification-labels' })).toBe(false)
  })

  it('should return false for archive-rerun-feedback (advisory)', () => {
    expect(isBlockingPostAction({ type: 'archive-rerun-feedback' })).toBe(false)
  })

  it('should return false for run-tsc (advisory)', () => {
    expect(isBlockingPostAction({ type: 'run-tsc' })).toBe(false)
  })

  it('should return false for run-unit-tests (advisory)', () => {
    expect(isBlockingPostAction({ type: 'run-unit-tests' })).toBe(false)
  })

  it('should return false for run-quality-with-autofix (advisory)', () => {
    expect(
      isBlockingPostAction({
        type: 'run-quality-with-autofix',
        gates: [{ name: 'tsc', command: 'pnpm tsc', source: 'tsc' }],
        maxFeedbackLoops: 3,
      }),
    ).toBe(false)
  })

  it('should return false for analyze-review-findings (advisory)', () => {
    expect(isBlockingPostAction({ type: 'analyze-review-findings' })).toBe(false)
  })

  it('should return false for clear-verify-failures (advisory)', () => {
    expect(isBlockingPostAction({ type: 'clear-verify-failures' })).toBe(false)
  })

  it('should return false for run-mechanical-autofix (advisory)', () => {
    expect(isBlockingPostAction({ type: 'run-mechanical-autofix' })).toBe(false)
  })

  it('should return false for parallel (advisory - delegates to children)', () => {
    expect(
      isBlockingPostAction({
        type: 'parallel',
        actions: [{ type: 'validate-task-json' }],
      }),
    ).toBe(false)
  })
})

/**
 * @fileType test-helper
 * @domain cody | testing
 * @ai-summary Shared test fixtures for cody pipeline tests
 */

import type { PipelineStateV2, StageStateV2 } from '../../../scripts/cody/engine/types'

/**
 * Create a valid TaskDefinition object for testing.
 */
export function createValidTaskDefinition(overrides?: Record<string, unknown>) {
  return {
    task_type: 'implement_feature' as const,
    risk_level: 'medium' as const,
    confidence: 0.85,
    primary_domain: 'backend' as const,
    scope: ['Test scope item'],
    missing_inputs: [],
    assumptions: ['Test assumption'],
    review_questions: [],
    complexity: 50,
    ...overrides,
  }
}

/**
 * Create a valid StageStateV2 object for testing.
 */
export function createStageState(overrides?: Partial<StageStateV2>): StageStateV2 {
  return {
    state: 'pending',
    retries: 0,
    ...overrides,
  }
}

/**
 * Create a valid PipelineStateV2 object for testing.
 */
export function createValidPipelineState(overrides?: Partial<PipelineStateV2>): PipelineStateV2 {
  return {
    version: 2,
    taskId: 'test-task-001',
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

/** Sample task.md content for tests */
export const MOCK_TASK_MD = `# Test Task

## Description
This is a test task for unit testing.

## Requirements
- Implement feature X
- Add tests for feature X
`

/** Sample spec.md content for tests */
export const MOCK_SPEC_MD = `# Specification: Test Task

## Requirements
1. Must do X
2. Must handle Y

## Acceptance Criteria
- [ ] Feature X works
- [ ] Tests pass
`

/**
 * @fileType test-helper
 * @domain cody | testing
 * @ai-summary Pipeline context factory and mock backend for integration testing
 */

import { vi } from 'vitest'
import type { PipelineContext } from '../../../scripts/cody/engine/types'
import type { RunnerBackend } from '../../../scripts/cody/runner-backend'
import type { CodyInput } from '../../../scripts/cody/cody-utils'

/**
 * Create a mock RunnerBackend for testing.
 */
export function createMockRunnerBackend(): RunnerBackend {
  return {
    name: 'test-runner' as const,
    spawn: vi.fn(),
  }
}

/**
 * Create a minimal PipelineContext for testing.
 * All fields have sensible defaults that can be overridden.
 */
export function createMockPipelineContext(overrides?: Partial<PipelineContext>): PipelineContext {
  const taskId = overrides?.taskId ?? 'test-task-001'
  const taskDir = overrides?.taskDir ?? `/tmp/test-tasks/${taskId}`
  const input: CodyInput = {
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
    ...(overrides?.input ?? {}),
  }

  return {
    taskId,
    taskDir,
    input,
    taskDef: null,
    profile: 'standard',
    backend: createMockRunnerBackend(),
    ...overrides,
  }
}

/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern pipeline-utils
 * @ai-summary Pipeline utility functions — stage output, dry-run, parallel stage helpers
 */

import * as fs from 'fs'

import { stageOutputFile } from './stages/registry'

// Re-export everything from extracted modules for backward compatibility
export * from './pipeline/task-schema'
export * from './pipeline/complexity'
export { readTask } from './pipeline/task-io'

export { stageOutputFile } from './stages/registry'

// --- Pipeline stage definitions ---

export const SPEC_ONLY_STAGES = ['gap', 'clarify']

// --- Dry-run support ---

const DRY_RUN_OUTPUTS: Record<string, (taskId: string) => string> = {
  taskify: () =>
    JSON.stringify(
      {
        task_type: 'implement_feature',
        risk_level: 'medium',
        confidence: 0.9,
        primary_domain: 'backend',
        scope: ['[dry-run] Mock scope item'],
        missing_inputs: [],
        assumptions: ['[dry-run] Mock assumption'],
        review_questions: [],
      },
      null,
      2,
    ),
  gap: (taskId) => `# Gap Analysis (dry-run)\n\nNo gaps identified for ${taskId}.\n`,
  clarify: (taskId) => `# Questions (dry-run)\n\n1. Mock question for ${taskId}?\n`,
  architect: (taskId) => `# Plan (dry-run)\n\nMock plan for ${taskId}.\n`,
  build: (taskId) => `# Build (dry-run)\n\nMock build output for ${taskId}.\n`,
  test: (taskId) => `# Test (dry-run)\n\nMock test output for ${taskId}.\n`,
  verify: (taskId) => `# Verify (dry-run)\n\nResult: PASS\n\nMock verification for ${taskId}.\n`,
  commit: (taskId) => `# Commit (dry-run)

Mock commit output for ${taskId}.
`,
  autofix: (taskId) => `# Autofix (dry-run)

No errors to fix for ${taskId}.
`,
  pr: (taskId) => `# PR (dry-run)

Mock PR output for ${taskId}.
`,
}

export function writeDryRunOutput(taskDir: string, stage: string, taskId: string): void {
  const outputFile = stageOutputFile(taskDir, stage)
  const generator = DRY_RUN_OUTPUTS[stage]
  const content = generator ? generator(taskId) : `# ${stage} (dry-run)\n\nMock output.\n`
  fs.writeFileSync(outputFile, content)
}

// --- Parallel stage support ---

/**
 * A pipeline stage is either a single stage name (string) or a parallel group.
 * Parallel groups run all contained stages concurrently.
 */
export type PipelineStage = string | { parallel: string[] }

/**
 * Check if a pipeline stage is a parallel group
 */
export function isParallelStage(stage: PipelineStage): stage is { parallel: string[] } {
  return typeof stage === 'object' && 'parallel' in stage
}

/**
 * Flatten a pipeline stage definition to its constituent stage names.
 * For a string, returns [stage]. For parallel, returns all contained stages.
 */
export function flattenStage(stage: PipelineStage): string[] {
  if (isParallelStage(stage)) {
    return stage.parallel
  }
  return [stage]
}

/**
 * Flatten an entire pipeline definition to a flat list of stage names.
 */
export function flattenPipeline(stages: PipelineStage[]): string[] {
  return stages.flatMap(flattenStage)
}

// --- Pipeline stage definitions moved to stages/registry.ts ---
// Use IMPL_ORDER_STANDARD, IMPL_ORDER_LIGHTWEIGHT, etc. from registry.

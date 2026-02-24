/**
 * @fileType configuration
 * @domain cody | pipeline
 * @pattern pipeline-definitions
 * @ai-summary Declarative stage configurations for the Cody pipeline state machine
 */

import type {
  PipelineDefinition,
  PipelineContext,
  StageDefinition,
  PipelineStep,
} from '../engine/types'
import { STAGE_TIMEOUTS, DEFAULT_TIMEOUT } from '../agent-runner'
import { ensureFeatureBranch } from '../git-utils'
import { readTask } from '../pipeline-utils'
import {
  createSpecValidator,
  createGapValidator,
  createPlanGapValidator,
  createBuildValidator,
} from './validators'
import {
  skipIfInputQuality,
  skipIfClarifyDisabled,
  skipIfNoAuditorOutput,
  skipIfSpecHasNoOpenQuestions,
  skipIfSpecOnly,
} from './skip-conditions'

// ============================================================================
// Pipeline Orders
// ============================================================================

export const SPEC_ORDER_STANDARD: string[] = ['taskify', 'spec', 'gap', 'clarify']
export const SPEC_ORDER_LIGHTWEIGHT: string[] = ['taskify', 'clarify']
export const IMPL_ORDER_STANDARD: PipelineStep[] = [
  'architect',
  'plan-gap',
  'build',
  'commit',
  { parallel: ['verify', 'auditor'] },
  'apply-audit',
  'pr',
]
export const IMPL_ORDER_LIGHTWEIGHT: PipelineStep[] = [
  'architect',
  'build',
  'commit',
  'verify',
  'pr',
]

// ============================================================================
// Stage Definitions
// ============================================================================

/**
 * Create all stage definitions
 */
function createStageDefinitions(ctx: PipelineContext): Map<string, StageDefinition> {
  const stages = new Map<string, StageDefinition>()

  // taskify stage
  stages.set('taskify', {
    name: 'taskify',
    type: 'agent',
    timeout: STAGE_TIMEOUTS.taskify ?? DEFAULT_TIMEOUT,
    maxRetries: 1,
    postActions: [
      { type: 'validate-task-json' },
      { type: 'resolve-profile' },
      { type: 'check-gate', gate: 'taskify' },
      {
        type: 'commit-task-files',
        stagingStrategy: 'task-only',
        push: true,
        ensureBranch: true,
      },
    ],
  })

  // spec stage
  stages.set('spec', {
    name: 'spec',
    type: 'agent',
    timeout: STAGE_TIMEOUTS.spec ?? DEFAULT_TIMEOUT,
    maxRetries: 1,
    shouldSkip: (ctx) => skipIfInputQuality(ctx, 'spec'),
    validator: createSpecValidator(ctx),
  })

  // gap stage
  stages.set('gap', {
    name: 'gap',
    type: 'agent',
    timeout: STAGE_TIMEOUTS.gap ?? DEFAULT_TIMEOUT,
    maxRetries: 1,
    shouldSkip: (ctx) => skipIfInputQuality(ctx, 'gap'),
    validator: createGapValidator(ctx),
  })

  // clarify stage - NO post-actions (G17)
  stages.set('clarify', {
    name: 'clarify',
    type: 'agent',
    timeout: STAGE_TIMEOUTS.clarify ?? DEFAULT_TIMEOUT,
    maxRetries: 1,
    shouldSkip: (ctx) => {
      // First try input quality skip
      const inputQualitySkip = skipIfInputQuality(ctx, 'clarify')
      if (inputQualitySkip.shouldSkip) return inputQualitySkip

      // Then try clarify disabled skip
      const clarifyDisabledSkip = skipIfClarifyDisabled(ctx)
      if (clarifyDisabledSkip.shouldSkip) return clarifyDisabledSkip

      // Then try no open questions skip (only when clarify IS enabled)
      const noQuestionsSkip = skipIfSpecHasNoOpenQuestions(ctx)
      return noQuestionsSkip
    },
  })

  // architect stage
  stages.set('architect', {
    name: 'architect',
    type: 'agent',
    timeout: STAGE_TIMEOUTS.architect ?? DEFAULT_TIMEOUT,
    maxRetries: 1,
    shouldSkip: (ctx) => skipIfSpecOnly(ctx),
    postActions: [
      { type: 'archive-rerun-feedback' },
      { type: 'check-gate', gate: 'architect', includeArtifact: 'plan.md' },
    ],
  })

  // plan-gap stage
  stages.set('plan-gap', {
    name: 'plan-gap',
    type: 'agent',
    timeout: STAGE_TIMEOUTS['plan-gap'] ?? DEFAULT_TIMEOUT,
    maxRetries: 1,
    shouldSkip: (ctx) => skipIfInputQuality(ctx, 'plan-gap'),
    postActions: [{ type: 'validate-plan-exists' }],
    validator: createPlanGapValidator(ctx),
  })

  // build stage - has preExecute for ensureFeatureBranch (G20)
  stages.set('build', {
    name: 'build',
    type: 'agent',
    timeout: STAGE_TIMEOUTS.build ?? DEFAULT_TIMEOUT,
    maxRetries: 1,
    shouldSkip: (ctx) => skipIfInputQuality(ctx, 'build'),
    preExecute: async (ctx) => {
      if (!ctx.input.dryRun) {
        const td = readTask(ctx.taskDir)
        if (td) {
          ensureFeatureBranch(ctx.taskId, td.task_type)
        }
      }
    },
    postActions: [
      { type: 'validate-build-content' },
      { type: 'run-tsc' },
      { type: 'run-unit-tests' },
    ],
    validator: createBuildValidator(),
  })

  // commit stage
  stages.set('commit', {
    name: 'commit',
    type: 'git',
    timeout: STAGE_TIMEOUTS.commit ?? DEFAULT_TIMEOUT,
    maxRetries: 0,
  })

  // verify stage
  stages.set('verify', {
    name: 'verify',
    type: 'scripted',
    timeout: STAGE_TIMEOUTS.verify ?? DEFAULT_TIMEOUT,
    maxRetries: 0,
    postActions: [
      // LOCAL-ONLY commit of task files after verify completes (G18)
      // NOT the autofix commit - that's inside ScriptedVerifyHandler
      {
        type: 'commit-task-files',
        stagingStrategy: 'task-only',
        push: false,
        ensureBranch: false,
        localOnly: true,
      },
    ],
  })

  // auditor stage - advisory (non-blocking)
  // R11: Removed shouldSkip - auditor creates auditor.md, so skipIfNoAuditorOutput would always skip
  stages.set('auditor', {
    name: 'auditor',
    type: 'agent',
    timeout: STAGE_TIMEOUTS.auditor ?? DEFAULT_TIMEOUT,
    maxRetries: 0,
    advisory: true,
  })

  // apply-audit stage
  stages.set('apply-audit', {
    name: 'apply-audit',
    type: 'agent',
    timeout: STAGE_TIMEOUTS['apply-audit'] ?? DEFAULT_TIMEOUT,
    maxRetries: 1,
    shouldSkip: (ctx) => skipIfNoAuditorOutput(ctx),
    postActions: [
      // LOCAL-ONLY commit of task files (G18)
      {
        type: 'commit-task-files',
        stagingStrategy: 'task-only',
        push: false,
        ensureBranch: false,
        localOnly: true,
      },
      // Audit history commit (R7)
      { type: 'commit-audit-history' },
    ],
  })

  // pr stage
  stages.set('pr', {
    name: 'pr',
    type: 'git',
    timeout: STAGE_TIMEOUTS.pr ?? DEFAULT_TIMEOUT,
    maxRetries: 0,
  })

  return stages
}

// ============================================================================
// Pipeline Builder
// ============================================================================

/**
 * Flatten a mixed sequential/parallel pipeline order into a flat array of stage names.
 * Used by rerun mode to get dynamic stage order from pipeline definitions.
 */
export function flattenPipelineOrder(order: PipelineStep[]): string[] {
  const result: string[] = []
  for (const step of order) {
    if (typeof step === 'string') {
      result.push(step)
    } else if ('parallel' in step) {
      result.push(...step.parallel)
    }
  }
  return result
}

/**
 * Build pipeline definition based on mode, profile, and clarify flag
 */
export function buildPipeline(
  mode: 'spec' | 'impl' | 'full' | 'rerun',
  profile: 'standard' | 'lightweight',
  clarify: boolean,
  ctx: PipelineContext,
): PipelineDefinition {
  const stages = createStageDefinitions(ctx)

  // Determine stage order based on mode and profile
  let order: PipelineStep[] = []

  if (mode === 'spec' || mode === 'full') {
    // Spec stages
    const specOrder = profile === 'standard' ? SPEC_ORDER_STANDARD : SPEC_ORDER_LIGHTWEIGHT

    // If clarify is disabled, remove it from the spec order
    const filteredSpecOrder = clarify ? specOrder : specOrder.filter((s) => s !== 'clarify')

    order = [...filteredSpecOrder]

    // For full mode, we'll rebuild after taskify to add impl stages
    if (mode === 'full') {
      // Full mode starts with just spec stages; impl stages added after taskify
      // The engine's rebuildPipeline callback handles this
      return { stages, order }
    }
  } else if (mode === 'impl' || mode === 'rerun') {
    // Implementation stages
    const implOrder = profile === 'standard' ? IMPL_ORDER_STANDARD : IMPL_ORDER_LIGHTWEIGHT
    order = [...implOrder]
  }

  return { stages, order }
}

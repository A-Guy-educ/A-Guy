/**
 * @fileType configuration
 * @domain cody | pipeline
 * @pattern pipeline-definitions
 * @ai-summary Declarative stage configurations for the Cody pipeline state machine
 */

import * as fs from 'fs'
import * as path from 'path'

import type {
  PipelineDefinition,
  PipelineContext,
  StageDefinition,
  PipelineStep,
} from '../engine/types'
import { STAGE_TIMEOUTS, DEFAULT_TIMEOUT } from '../agent-runner'
import { ensureFeatureBranch } from '../git-utils'
import { readTask } from '../pipeline-utils'
import { setBranchName, loadState } from '../engine/status'
import { execSync } from 'child_process'
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
  skipIfBelowComplexity,
} from './skip-conditions'
import { STAGE_COMPLEXITY_THRESHOLDS } from '../pipeline-utils'

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
  'verify',
  'auditor',
  'apply-audit',
  'pr',
]
export const IMPL_ORDER_LIGHTWEIGHT: PipelineStep[] = [
  'architect',
  'build',
  'commit',
  'verify',
  'auditor',
  'apply-audit',
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
    maxRetries: 2, // BUG-F fix: increased from 1 to 2 for better resilience
    postActions: [
      { type: 'validate-task-json' },
      { type: 'set-classification-labels' },
      // NOTE: resolve-profile MUST be last to ensure profile is resolved before check-gate runs
      // see issue #1 in pipeline analysis - profile race condition fix
      { type: 'check-gate', gate: 'taskify' },
      {
        type: 'commit-task-files',
        stagingStrategy: 'task-only',
        push: true,
        ensureBranch: true,
      },
      { type: 'resolve-profile' }, // Must be last - triggers pipeline rebuild for next stages
    ],
  })

  // spec stage
  stages.set('spec', {
    name: 'spec',
    type: 'agent',
    timeout: STAGE_TIMEOUTS.spec ?? DEFAULT_TIMEOUT,
    maxRetries: 1,
    minComplexity: STAGE_COMPLEXITY_THRESHOLDS.spec,
    shouldSkip: (ctx) => {
      const complexitySkip = skipIfBelowComplexity(ctx, 'spec')
      if (complexitySkip.shouldSkip) return complexitySkip
      return skipIfInputQuality(ctx, 'spec')
    },
    validator: createSpecValidator(ctx),
  })

  // gap stage
  stages.set('gap', {
    name: 'gap',
    type: 'agent',
    timeout: STAGE_TIMEOUTS.gap ?? DEFAULT_TIMEOUT,
    maxRetries: 1,
    minComplexity: STAGE_COMPLEXITY_THRESHOLDS.gap,
    shouldSkip: (ctx) => {
      const complexitySkip = skipIfBelowComplexity(ctx, 'gap')
      if (complexitySkip.shouldSkip) return complexitySkip
      return skipIfInputQuality(ctx, 'gap')
    },
    validator: createGapValidator(ctx),
  })

  // clarify stage - NO post-actions (G17)
  stages.set('clarify', {
    name: 'clarify',
    type: 'agent',
    timeout: STAGE_TIMEOUTS.clarify ?? DEFAULT_TIMEOUT,
    maxRetries: 1,
    minComplexity: STAGE_COMPLEXITY_THRESHOLDS.clarify,
    shouldSkip: (ctx) => {
      // First check complexity threshold
      const complexitySkip = skipIfBelowComplexity(ctx, 'clarify')
      if (complexitySkip.shouldSkip) return complexitySkip

      // Then try input quality skip
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
    minComplexity: STAGE_COMPLEXITY_THRESHOLDS.architect,
    shouldSkip: (ctx) => {
      const complexitySkip = skipIfBelowComplexity(ctx, 'architect')
      if (complexitySkip.shouldSkip) return complexitySkip
      return skipIfSpecOnly(ctx)
    },
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
    minComplexity: STAGE_COMPLEXITY_THRESHOLDS['plan-gap'],
    shouldSkip: (ctx) => {
      const complexitySkip = skipIfBelowComplexity(ctx, 'plan-gap')
      if (complexitySkip.shouldSkip) return complexitySkip
      return skipIfInputQuality(ctx, 'plan-gap')
    },
    postActions: [{ type: 'validate-plan-exists' }],
    validator: createPlanGapValidator(ctx),
    fallbackOnMissingOutput: (ctx) => {
      // If agent edited plan.md but forgot to write plan-gap.md, create a fallback
      const planFile = path.join(ctx.taskDir, 'plan.md')
      if (fs.existsSync(planFile)) {
        return `# Plan Gap Analysis: ${ctx.taskId}

## Summary

- Gaps Found: 0
- Plan Revised: Yes (agent edited plan.md directly)

## Changes Made to Plan

Agent revised plan.md but did not produce a separate gap report.
See plan.md for the revised plan.

## No Gaps Found

No critical gaps identified. Plan was refined in-place.
`
      }
      return null
    },
  })

  // build stage - has preExecute for ensureFeatureBranch (G20)
  stages.set('build', {
    name: 'build',
    type: 'agent',
    timeout: STAGE_TIMEOUTS.build ?? DEFAULT_TIMEOUT,
    maxRetries: 1,
    minComplexity: STAGE_COMPLEXITY_THRESHOLDS.build,
    shouldSkip: (ctx) => skipIfInputQuality(ctx, 'build'),
    preExecute: async (ctx) => {
      if (!ctx.input.dryRun) {
        const td = readTask(ctx.taskDir)
        if (td) {
          ensureFeatureBranch(ctx.taskId, td.task_type, undefined, ctx.taskDir)

          // Capture the branch name and persist to status.json for dashboard lookups
          try {
            const currentBranch = execSync('git branch --show-current', {
              encoding: 'utf-8',
            }).trim()
            if (currentBranch) {
              const state = loadState(ctx.taskId)
              if (state) {
                setBranchName(ctx.taskId, state, currentBranch)
              }
            }
          } catch {
            // Non-critical — branch name is a convenience field
          }
        }
      }
    },
    postActions: [
      { type: 'validate-src-changes' },
      { type: 'validate-build-content' },
      {
        type: 'run-quality-with-autofix',
        gates: [
          { name: 'TypeScript', command: 'pnpm -s tsc --noEmit', source: 'tsc' as const },
          { name: 'Unit Tests', command: 'pnpm -s test:unit', source: 'test' as const },
        ],
        maxFeedbackLoops: 2,
      },
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
    maxRetries: 1, // Was 0 - added retry so LLM gets feedback when it fails to write file
    advisory: true,
    minComplexity: STAGE_COMPLEXITY_THRESHOLDS.auditor,
    shouldSkip: (ctx) => skipIfBelowComplexity(ctx, 'auditor'),
    fallbackOnMissingOutput: (ctx) => {
      // Fallback if LLM fails to write auditor.md - generate minimal report
      // This allows apply-audit stage to run instead of being skipped
      return `# Auditor Report: ${ctx.taskId}

## Task Info

- **Task ID:** ${ctx.taskId}
- **Task Type:** unknown
- **Run State:** SUCCESS
- **Date:** ${new Date().toISOString()}

## Stage Analysis

| Stage | Quality |
| ------ | ------- |
| spec | reviewed |
| plan | reviewed |
| build | reviewed |
| verify | reviewed |

## Process Delta

- No major process gaps identified

## Primary Improvement

- **Type:** PIPELINE
- **Title:** Auditor output detection reliability
- **Rationale:** LLM occasionally prints to stdout instead of writing file
- **Where:** scripts/cody/pipeline/definitions.ts
- **Effectiveness:** unknown

## Additional Findings

1. **Type:** PROMPT
   - **Title:** Reinforce file writing requirement
   - **Rationale:** LLM may print report to chat instead of writing file
   - **Where:** .opencode/agents/auditor.md
`
    },
  })

  // apply-audit stage
  stages.set('apply-audit', {
    name: 'apply-audit',
    type: 'agent',
    timeout: STAGE_TIMEOUTS['apply-audit'] ?? DEFAULT_TIMEOUT,
    maxRetries: 1,
    minComplexity: STAGE_COMPLEXITY_THRESHOLDS['apply-audit'],
    shouldSkip: (ctx) => {
      const complexitySkip = skipIfBelowComplexity(ctx, 'apply-audit')
      if (complexitySkip.shouldSkip) return complexitySkip
      return skipIfNoAuditorOutput(ctx)
    },
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
 * Rebuild pipeline after taskify completes
 * Extends the pipeline with remaining stages based on profile
 */
export function rebuildPipelineAfterTaskify(
  _currentPipeline: PipelineDefinition,
  ctx: PipelineContext,
): PipelineDefinition {
  // For full mode, we need BOTH spec stages (completed) AND impl stages (to run)
  // Build spec stages based on profile
  const specOrder = ctx.profile === 'standard' ? SPEC_ORDER_STANDARD : SPEC_ORDER_LIGHTWEIGHT
  const filteredSpecOrder = ctx.input.clarify ? specOrder : specOrder.filter((s) => s !== 'clarify')

  // Build impl stages based on profile
  const implOrder = ctx.profile === 'standard' ? IMPL_ORDER_STANDARD : IMPL_ORDER_LIGHTWEIGHT

  // Combine: spec stages first (already completed), then impl stages (to run)
  return {
    stages: createStageDefinitions(ctx),
    order: [...filteredSpecOrder, ...implOrder],
  }
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

  if (mode === 'spec') {
    // Spec stages only
    const specOrder = profile === 'standard' ? SPEC_ORDER_STANDARD : SPEC_ORDER_LIGHTWEIGHT
    // If clarify is disabled, remove it from the spec order
    const filteredSpecOrder = clarify ? specOrder : specOrder.filter((s) => s !== 'clarify')
    order = [...filteredSpecOrder]
  } else if (mode === 'impl') {
    // Implementation stages only
    const implOrder = profile === 'standard' ? IMPL_ORDER_STANDARD : IMPL_ORDER_LIGHTWEIGHT
    order = [...implOrder]
  } else if (mode === 'full' || mode === 'rerun') {
    // Full/rerun mode: include both spec and impl stages
    // This ensures the pipeline survives restarts — all stages are present
    // and the state machine efficiently skips completed ones
    const specOrder = profile === 'standard' ? SPEC_ORDER_STANDARD : SPEC_ORDER_LIGHTWEIGHT
    const implOrder = profile === 'standard' ? IMPL_ORDER_STANDARD : IMPL_ORDER_LIGHTWEIGHT
    const filteredSpecOrder = clarify ? specOrder : specOrder.filter((s) => s !== 'clarify')
    order = [...filteredSpecOrder, ...implOrder]
  }

  return { stages, order }
}

/**
 * Flatten pipeline order (including parallel stages) into a flat array of stage names
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

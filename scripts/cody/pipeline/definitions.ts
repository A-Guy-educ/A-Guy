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
import {
  type StageName,
  getStageTimeout,
  getStageComplexityThreshold,
  SPEC_ORDER_STANDARD,
  SPEC_ORDER_LIGHTWEIGHT,
  IMPL_ORDER_STANDARD,
  IMPL_ORDER_LIGHTWEIGHT,
  SPEC_ORDER_TURBO,
  IMPL_ORDER_TURBO,
} from '../stages/registry'
import { ensureFeatureBranch } from '../git-utils'
import { readTask } from '../pipeline-utils'
import { setBranchName, loadState } from '../engine/status'
import { execFileSync } from 'child_process'
import {
  createGapValidator,
  createPlanGapValidator,
  createBuildValidator,
  createDocsValidator,
  createTestValidator,
} from './validators'
import {
  skipIfInputQuality,
  skipIfClarifyDisabled,
  skipIfSpecHasNoOpenQuestions,
  skipIfSpecOnly,
  skipIfBelowComplexity,
} from './skip-conditions'

// Re-export pipeline order arrays from registry for backward compatibility
export {
  SPEC_ORDER_STANDARD,
  SPEC_ORDER_LIGHTWEIGHT,
  IMPL_ORDER_STANDARD,
  IMPL_ORDER_LIGHTWEIGHT,
  SPEC_ORDER_TURBO,
  IMPL_ORDER_TURBO,
  FIX_ORDER,
  FIX_FULL_ORDER,
} from '../stages/registry'

// ============================================================================
// Stage Definitions
// ============================================================================

/**
 * Create all stage definitions
 */
function createStageDefinitions(ctx: PipelineContext): Map<StageName, StageDefinition> {
  const stages = new Map<StageName, StageDefinition>()

  // taskify stage
  stages.set('taskify', {
    name: 'taskify',
    type: 'agent',
    timeout: getStageTimeout('taskify'),
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

  // gap stage (also writes spec.md — spec stage was merged into gap)
  stages.set('gap', {
    name: 'gap',
    type: 'agent',
    timeout: getStageTimeout('gap'),
    maxRetries: 1,
    minComplexity: getStageComplexityThreshold('gap'),
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
    timeout: getStageTimeout('clarify'),
    maxRetries: 1,
    minComplexity: getStageComplexityThreshold('clarify'),
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
    timeout: getStageTimeout('architect'),
    maxRetries: 1,
    minComplexity: getStageComplexityThreshold('architect'),
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
    timeout: getStageTimeout('plan-gap'),
    maxRetries: 1,
    minComplexity: getStageComplexityThreshold('plan-gap'),
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

  // test stage — TDD red phase: writes failing tests in parallel with build
  stages.set('test', {
    name: 'test',
    type: 'agent',
    timeout: getStageTimeout('test'),
    maxRetries: 1,
    minComplexity: getStageComplexityThreshold('test'),
    shouldSkip: (ctx) => skipIfInputQuality(ctx, 'test'),
    preExecute: async (ctx) => {
      // Ensure feature branch for deferred test runs (triggered by inspector plugin).
      // Without this, the test stage would try to commit/push to dev (branch-protected).
      if (!ctx.input.dryRun) {
        try {
          const td = readTask(ctx.taskDir)
          if (td) {
            ensureFeatureBranch(ctx.taskId, td.task_type, undefined, ctx.taskDir)
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          throw new Error(`Test stage preExecute failed: ${msg}`)
        }
      }
    },
    postActions: [
      // Commit test files after test stage completes (for deferred test runs)
      {
        type: 'commit-task-files',
        stagingStrategy: 'tracked+task',
        push: true,
        ensureBranch: true,
      },
    ],
    validator: createTestValidator(),
  })
  // build stage - has preExecute for ensureFeatureBranch (G20)
  stages.set('build', {
    name: 'build',
    type: 'agent',
    timeout: getStageTimeout('build'),
    maxRetries: 1,
    minComplexity: getStageComplexityThreshold('build'),
    shouldSkip: (ctx) => skipIfInputQuality(ctx, 'build'),
    preExecute: async (ctx) => {
      if (!ctx.input.dryRun) {
        try {
          const td = readTask(ctx.taskDir)
          if (td) {
            ensureFeatureBranch(ctx.taskId, td.task_type, undefined, ctx.taskDir)

            // Capture the branch name and persist to status.json for dashboard lookups
            try {
              const currentBranch = execFileSync('git', ['branch', '--show-current'], {
                encoding: 'utf-8',
                timeout: 10000, // 10 seconds
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
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          throw new Error(`Build stage preExecute failed: ${msg}`)
        }
      }
    },
    postActions: [
      { type: 'validate-src-changes' },
      { type: 'validate-build-content' },
      // Commit code BEFORE quality gates so work is preserved even if gates fail.
      // Without this, a gate failure means all build agent work is lost.
      {
        type: 'commit-task-files',
        stagingStrategy: 'tracked+task',
        push: true,
        ensureBranch: true,
      },
      // Run lint:fix + format:fix mechanically BEFORE quality gates.
      // This is deterministic (no LLM needed) and prevents trivial format/lint
      // failures from reaching verify stage or wasting LLM fix attempts.
      { type: 'run-mechanical-autofix' },
      {
        type: 'run-quality-with-autofix',
        gates: [
          { name: 'TypeScript', command: 'pnpm -s tsc --noEmit', source: 'tsc' as const },
          // Unit Tests gate removed — tests are deferred to inspector plugin (cody-deferred-tests)
        ],
        maxFeedbackLoops: 2,
      },
    ],
    validator: createBuildValidator(),
  })

  // review stage - architect agent reviews generated code
  stages.set('review', {
    name: 'review',
    type: 'agent',
    timeout: getStageTimeout('review'),
    maxRetries: 0,
    minComplexity: getStageComplexityThreshold('review'),
    shouldSkip: (ctx) => {
      const complexitySkip = skipIfBelowComplexity(ctx, 'review')
      if (complexitySkip.shouldSkip) return complexitySkip
      return { shouldSkip: false }
    },
    postActions: [
      { type: 'analyze-review-findings' },
      { type: 'commit-task-files', stagingStrategy: 'task-only', push: true, ensureBranch: false },
    ],
  })

  // fix stage — re-invokes build agent to fix review findings
  // The build agent has full context (spec, plan, code intent) and wrote the code.
  stages.set('fix', {
    name: 'fix',
    type: 'agent',
    agentName: 'build', // Build agent fixes its own code based on review.md
    timeout: getStageTimeout('fix'),
    maxRetries: 2,
    shouldSkip: (ctx) => {
      // In fix mode, never skip — user explicitly requested fixes
      if (ctx.input.mode === 'fix') {
        return { shouldSkip: false }
      }
      const state = loadState(ctx.taskId)
      const fixStage = state?.stages?.fix
      if (
        fixStage?.fixAttempt !== undefined &&
        fixStage.fixAttempt >= (fixStage.maxFixAttempts ?? 2)
      ) {
        return { shouldSkip: true, reason: 'Max fix attempts reached' }
      }
      const reviewStage = state?.stages?.review
      if (!reviewStage?.issuesFound) {
        const verifyFailuresPath = path.join(ctx.taskDir, 'verify-failures.md')
        if (!fs.existsSync(verifyFailuresPath)) {
          return { shouldSkip: true, reason: 'No issues to fix' }
        }
      }
      return { shouldSkip: false }
    },
    postActions: [
      {
        type: 'commit-task-files',
        stagingStrategy: 'tracked+task',
        push: true,
        ensureBranch: false,
      },
      { type: 'clear-verify-failures' },
    ],
  })

  // commit stage
  stages.set('commit', {
    name: 'commit',
    type: 'git',
    timeout: getStageTimeout('commit'),
    maxRetries: 0,
  })

  // verify stage
  stages.set('verify', {
    name: 'verify',
    type: 'scripted',
    timeout: getStageTimeout('verify'),
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

  // docs stage - deferred to nightly inspector (Knowledge Gardener plugin).
  // Kept here so the state machine can execute it if triggered directly (e.g., manual rerun).
  // Complexity threshold raised to 30 (moderate+) — trivial/simple tasks skip docs.
  stages.set('docs', {
    name: 'docs',
    type: 'agent',
    timeout: getStageTimeout('docs'),
    maxRetries: 1,
    minComplexity: getStageComplexityThreshold('docs'),
    shouldSkip: (ctx) => {
      const complexitySkip = skipIfBelowComplexity(ctx, 'docs')
      if (complexitySkip.shouldSkip) return complexitySkip
      return { shouldSkip: false }
    },
    validator: createDocsValidator(),
    postActions: [
      {
        type: 'commit-task-files',
        stagingStrategy: 'tracked+task',
        push: true,
        ensureBranch: false,
      },
    ],
  })

  // pr stage
  stages.set('pr', {
    name: 'pr',
    type: 'git',
    timeout: getStageTimeout('pr'),
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
  profile: 'standard' | 'lightweight' | 'turbo',
  clarify: boolean,
  ctx: PipelineContext,
): PipelineDefinition {
  const stages = createStageDefinitions(ctx)

  // Determine stage order based on mode and profile
  let order: PipelineStep[] = []

  if (mode === 'spec') {
    // Spec stages only
    const specOrder =
      profile === 'standard'
        ? SPEC_ORDER_STANDARD
        : profile === 'turbo'
          ? SPEC_ORDER_TURBO
          : SPEC_ORDER_LIGHTWEIGHT
    // If clarify is disabled, remove it from the spec order
    const filteredSpecOrder = clarify ? specOrder : specOrder.filter((s) => s !== 'clarify')
    order = [...filteredSpecOrder]
  } else if (mode === 'impl') {
    // Implementation stages only
    const implOrder =
      profile === 'standard'
        ? IMPL_ORDER_STANDARD
        : profile === 'turbo'
          ? IMPL_ORDER_TURBO
          : IMPL_ORDER_LIGHTWEIGHT
    order = [...implOrder]
  } else if (mode === 'full' || mode === 'rerun') {
    // Full/rerun mode: include both spec and impl stages
    // This ensures the pipeline survives restarts — all stages are present
    // and the state machine efficiently skips completed ones
    const specOrder =
      profile === 'standard'
        ? SPEC_ORDER_STANDARD
        : profile === 'turbo'
          ? SPEC_ORDER_TURBO
          : SPEC_ORDER_LIGHTWEIGHT
    const implOrder =
      profile === 'standard'
        ? IMPL_ORDER_STANDARD
        : profile === 'turbo'
          ? IMPL_ORDER_TURBO
          : IMPL_ORDER_LIGHTWEIGHT
    const filteredSpecOrder = clarify ? specOrder : specOrder.filter((s) => s !== 'clarify')
    order = [...filteredSpecOrder, ...implOrder]
  }

  return { stages, order }
}

/**
 * Flatten pipeline order (including parallel stages) into a flat array of stage names
 */
export function flattenPipelineOrder(order: PipelineStep[]): StageName[] {
  const result: StageName[] = []
  for (const step of order) {
    if (typeof step === 'string') {
      result.push(step)
    } else if ('parallel' in step) {
      result.push(...step.parallel)
    }
  }
  return result
}

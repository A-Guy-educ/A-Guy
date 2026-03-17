/**
 * @fileType configuration
 * @domain cody | pipeline
 * @pattern stage-registry
 * @ai-summary Single source of truth for all pipeline stage metadata, types, and order arrays
 */

import ms from 'ms'

// ============================================================================
// Stage Names — the canonical list
// ============================================================================

/**
 * All valid stage names in the Cody pipeline.
 *
 * Excluded:
 * - 'spec' — merged into 'gap' months ago (ghost stage)
 * - 'autofix' — not a real pipeline stage; it's a sub-behavior of build feedback loops
 */
export const STAGE_NAMES = [
  'taskify',
  'gap',
  'clarify',
  'architect',
  'plan-gap',
  'test',
  'build',
  'commit',
  'review',
  'fix',
  'verify',
  'docs',
  'pr',
] as const

export type StageName = (typeof STAGE_NAMES)[number]

/**
 * Named constant object for stage names — provides compile-time typo detection
 * and single-point rename capability. Use STAGES.BUILD instead of 'build' in new code.
 */
export const STAGES = {
  TASKIFY: 'taskify',
  GAP: 'gap',
  CLARIFY: 'clarify',
  ARCHITECT: 'architect',
  PLAN_GAP: 'plan-gap',
  TEST: 'test',
  BUILD: 'build',
  COMMIT: 'commit',
  REVIEW: 'review',
  FIX: 'fix',
  VERIFY: 'verify',
  DOCS: 'docs',
  PR: 'pr',
} as const satisfies Record<string, StageName>

// ============================================================================
// Stage Metadata
// ============================================================================

export interface StageMetadata {
  /** Expected output file name (e.g., 'task.json', 'plan.md') */
  outputFile: string
  /** Timeout in milliseconds */
  timeout: number
  /** Minimum complexity score to run (0 = always runs) */
  complexityThreshold: number
  /** Files the stage reads for context */
  contextFiles: string[]
  /** Handler dispatch type */
  type: 'agent' | 'scripted' | 'git' | 'gate'
}

/**
 * The stage registry — typed as Record<StageName, StageMetadata>.
 * Adding/removing from STAGE_NAMES without updating this record causes a compile error.
 */
export const STAGE_REGISTRY: Record<StageName, StageMetadata> = {
  taskify: {
    outputFile: 'task.json',
    timeout: ms('10m'),
    complexityThreshold: 0,
    contextFiles: ['task.md'],
    type: 'agent',
  },
  gap: {
    outputFile: 'gap.md',
    timeout: ms('15m'),
    complexityThreshold: 35,
    contextFiles: ['task.md', 'task.json'],
    type: 'agent',
  },
  clarify: {
    outputFile: 'questions.md',
    timeout: ms('10m'),
    complexityThreshold: 60,
    contextFiles: ['task.md', 'spec.md'],
    type: 'agent',
  },
  architect: {
    outputFile: 'plan.md',
    timeout: ms('30m'),
    complexityThreshold: 10,
    contextFiles: [
      'spec.md',
      'clarified.md',
      'rerun-feedback.md',
      'prev-run/plan.md',
      'prev-run/build.md',
      'prev-run/review.md',
    ],
    type: 'agent',
  },
  'plan-gap': {
    outputFile: 'plan-gap.md',
    timeout: ms('15m'),
    complexityThreshold: 50,
    contextFiles: ['spec.md', 'plan.md', 'task.json'],
    type: 'agent',
  },
  test: {
    outputFile: 'test.md',
    timeout: ms('20m'),
    complexityThreshold: 0,
    contextFiles: ['spec.md', 'clarified.md', 'plan.md', 'task.json'],
    type: 'agent',
  },
  build: {
    outputFile: 'build.md',
    timeout: ms('45m'),
    complexityThreshold: 0,
    contextFiles: [
      'spec.md',
      'clarified.md',
      'plan.md',
      'plan-gap.md',
      'context.md',
      'rerun-feedback.md',
      'build-errors.md',
      'review.md',
      'prev-run/build.md',
      'prev-run/review.md',
    ],
    type: 'agent',
  },
  commit: {
    outputFile: 'commit.md',
    timeout: ms('5m'),
    complexityThreshold: 0,
    contextFiles: ['task.json'],
    type: 'git',
  },
  review: {
    outputFile: 'review.md',
    timeout: ms('15m'),
    complexityThreshold: 30,
    contextFiles: ['review.md', 'build.md', 'plan.md', 'context.md', 'spec.md', 'clarified.md'],
    type: 'agent',
  },
  fix: {
    outputFile: 'fix.md',
    timeout: ms('30m'),
    complexityThreshold: 0,
    contextFiles: [
      'verify-failures.md',
      'review.md',
      'rerun-feedback.md',
      'fix-summary.md',
      'build.md',
      'plan.md',
      'context.md',
      'spec.md',
      'clarified.md',
      'prev-run/build.md',
    ],
    type: 'agent',
  },
  verify: {
    outputFile: 'verify.md',
    timeout: ms('10m'),
    complexityThreshold: 0,
    contextFiles: [],
    type: 'scripted',
  },
  docs: {
    outputFile: 'docs.md',
    timeout: ms('10m'),
    complexityThreshold: 30,
    contextFiles: ['build.md', 'task.json', 'review.md', 'context.md'],
    type: 'agent',
  },
  pr: {
    outputFile: 'pr.md',
    timeout: ms('5m'),
    complexityThreshold: 0,
    contextFiles: [],
    type: 'git',
  },
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the output file name for a stage.
 * Falls back to `${stage}.md` for stages without a specific mapping.
 */
export function getStageOutputFile(stage: StageName): string {
  return STAGE_REGISTRY[stage].outputFile
}

/**
 * Get the timeout for a stage in milliseconds.
 */
export function getStageTimeout(stage: StageName): number {
  return STAGE_REGISTRY[stage].timeout
}

/**
 * Get the minimum complexity threshold for a stage.
 */
export function getStageComplexityThreshold(stage: StageName): number {
  return STAGE_REGISTRY[stage].complexityThreshold
}

/**
 * Get the context files a stage needs to read.
 */
export function getStageContextFiles(stage: StageName): string[] {
  return STAGE_REGISTRY[stage].contextFiles
}

/**
 * Runtime type guard — checks if a string is a valid StageName.
 */
export function isValidStageName(name: string): name is StageName {
  return (STAGE_NAMES as readonly string[]).includes(name)
}

/**
 * Assert that a string is a valid StageName, or throw.
 */
export function assertStageName(name: string): StageName {
  if (!isValidStageName(name)) {
    throw new Error(`Invalid stage name: '${name}'. Valid stages: ${STAGE_NAMES.join(', ')}`)
  }
  return name
}

// ============================================================================
// Resolve output file path on disk
// ============================================================================

/**
 * Build the full path to a stage's output file.
 * For stages not in the registry, falls back to `${stage}.md`.
 */
export function stageOutputFile(taskDir: string, stage: string): string {
  if (isValidStageName(stage)) {
    const filename = STAGE_REGISTRY[stage].outputFile
    return `${taskDir}/${filename}`
  }
  // Fallback for unknown stages (backward compat)
  return `${taskDir}/${stage}.md`
}

// ============================================================================
// Pipeline Order Arrays (typed)
// ============================================================================

export type TypedPipelineStep = StageName | { parallel: StageName[] }

export const SPEC_ORDER_STANDARD: StageName[] = ['taskify', 'gap', 'clarify']
export const SPEC_ORDER_LIGHTWEIGHT: StageName[] = ['taskify', 'clarify']

export const IMPL_ORDER_STANDARD: TypedPipelineStep[] = [
  'architect',
  'plan-gap',
  'build', // test stage deferred to inspector plugin (cody-deferred-tests)
  'commit',
  'review',
  'fix',
  // NOTE: No second 'commit' here — fix stage commits via its post-action
  // (commit-task-files with tracked+task). A duplicate 'commit' entry would be
  // skipped by resolveNextStep since state.stages['commit'] is already completed.
  'verify',
  'pr',
]

export const IMPL_ORDER_LIGHTWEIGHT: TypedPipelineStep[] = [
  'architect',
  'build', // test stage deferred to inspector plugin (cody-deferred-tests)
  'commit',
  'review',
  'fix',
  'verify',
  'pr',
]

/** Turbo spec order — minimal: just taskify (no gap/clarify) */
export const SPEC_ORDER_TURBO: StageName[] = ['taskify']

/** Turbo impl order — minimal: build→commit→verify→pr (no architect/review/fix) */
export const IMPL_ORDER_TURBO: TypedPipelineStep[] = ['build', 'commit', 'verify', 'pr']

/** Fix-only pipeline order for @cody fix mode */
export const FIX_ORDER: TypedPipelineStep[] = ['review', 'fix', 'verify', 'pr']

/** Full pipeline order for fix mode — runs the full impl pipeline with taskify prepended */
export const FIX_FULL_ORDER: TypedPipelineStep[] = [
  'taskify',
  'architect',
  'plan-gap',
  { parallel: ['test', 'build'] },
  'commit',
  'review',
  'fix',
  'verify',
  'pr',
]

// ============================================================================
// Pipeline Utility Functions
// ============================================================================

/**
 * Flatten a typed pipeline step to its constituent stage names.
 */
export function flattenTypedStep(step: TypedPipelineStep): StageName[] {
  if (typeof step === 'string') return [step]
  return step.parallel
}

/**
 * Flatten an entire typed pipeline to a flat list of stage names.
 */
export function flattenTypedPipeline(steps: TypedPipelineStep[]): StageName[] {
  return steps.flatMap(flattenTypedStep)
}

/**
 * Spec-only stages (don't produce code).
 */
export const SPEC_STAGES: StageName[] = ['taskify', 'gap', 'clarify']

/**
 * Scripted stages that run directly without an LLM agent.
 */
export const SCRIPTED_STAGES: StageName[] = ['verify', 'commit', 'pr']

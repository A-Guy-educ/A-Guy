// pipeline-utils.ts - Shared utilities for pipeline scripts
import * as fs from 'fs'
import * as path from 'path'

// --- Context aggregation removed ---
// Agents now read individual files directly (listed in stage-prompts.ts STAGE_CONTEXT_FILES).
// The monolithic .context.md file is no longer generated.

// --- Task definition types and validation ---

const VALID_TASK_TYPES = [
  'spec_only',
  'implement_feature',
  'fix_bug',
  'refactor',
  'docs',
  'ops',
  'research',
] as const

const VALID_PIPELINES = ['spec_only', 'spec_execute_verify'] as const
const VALID_RISK_LEVELS = ['low', 'medium', 'high'] as const
const VALID_DOMAINS = ['backend', 'frontend', 'infra', 'data', 'llm', 'devops', 'product'] as const
const VALID_PIPELINE_PROFILES = ['lightweight', 'standard'] as const

// --- Input quality levels for smart stage skipping ---
export const VALID_INPUT_QUALITY_LEVELS = [
  'raw_idea',
  'good_spec',
  'detailed_plan',
  'spec_and_plan',
] as const

// Stages that cannot be skipped (gap analysis always runs)
export const NON_SKIPPABLE_STAGES = [
  'gap',
  'plan-gap',
  'build',
  'commit',
  'verify',
  'auditor',
  'apply-audit',
  'pr',
] as const

// Stages that CAN be skipped when input quality is high
export const SKIPPABLE_STAGES = ['spec', 'architect'] as const

export interface InputQuality {
  level: (typeof VALID_INPUT_QUALITY_LEVELS)[number]
  skip_stages: string[]
  reasoning: string
}

// --- Complexity scoring: determines which pipeline stages run ---
// Each stage has a minComplexity threshold. If a task's complexity score
// is below the threshold, the stage is skipped.

export const COMPLEXITY_MIN = 1
export const COMPLEXITY_MAX = 100

/**
 * Minimum complexity score required for each pipeline stage.
 * Stages with threshold 0 always run. Higher thresholds = only complex tasks.
 *
 * Tiers (stages activate at their individual thresholds, not all at tier boundary):
 *   1-9:   "Trivial"      → taskify, build, commit, verify, pr
 *   10-19: "Simple"        → + architect (10)
 *   20-34: "Moderate"      → + auditor (20), apply-audit (20)
 *   35-39: "Complex"       → + spec (35)
 *   40-49: "Complex"       → + gap (40)
 *   50-59: "Very Complex"  → + plan-gap (50)
 *   60+:   "Very Complex"  → + clarify (60)
 */
export const STAGE_COMPLEXITY_THRESHOLDS: Record<string, number> = {
  taskify: 0,
  spec: 35,
  gap: 40,
  clarify: 60,
  architect: 10,
  'plan-gap': 50,
  build: 0,
  commit: 0,
  verify: 0,
  auditor: 20,
  'apply-audit': 20,
  pr: 0,
}

/** Named complexity tiers for display/logging */
export type ComplexityTier = 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex'

export function getComplexityTier(score: number): ComplexityTier {
  if (score < 10) return 'trivial'
  if (score < 20) return 'simple'
  if (score < 35) return 'moderate'
  if (score < 50) return 'complex'
  return 'very_complex'
}

/**
 * Get stages that would run for a given complexity score.
 * Useful for logging and debugging.
 */
export function getStagesForComplexity(score: number): string[] {
  return Object.entries(STAGE_COMPLEXITY_THRESHOLDS)
    .filter(([, threshold]) => score >= threshold)
    .map(([stage]) => stage)
}

// --- Control mode: determines pipeline autonomy level ---
export type ControlMode = 'auto' | 'risk-gated' | 'hard-stop'

const CONTROL_MODE_MAP: Record<string, ControlMode> = {
  low: 'auto',
  medium: 'risk-gated',
  high: 'hard-stop',
}

/**
 * Resolve the control mode for a task based on its risk level.
 * User can override with explicit flags (--auto, --gate, --hard-stop).
 */
export function resolveControlMode(taskDef: TaskDefinition, override?: ControlMode): ControlMode {
  // Explicit override always wins (from /cody --auto, --gate, --hard-stop)
  if (override) return override

  // Derive from risk_level
  return CONTROL_MODE_MAP[taskDef.risk_level] ?? 'auto'
}

/**
 * Lightweight tasks: simple fixes that skip heavyweight stages (spec, gap, plan-gap, auditor, apply-audit)
 *
 * When complexity score is available, derives profile from it:
 *   complexity < 35 → lightweight (no spec/gap needed)
 *   complexity >= 35 → standard (full pipeline)
 */
export function resolvePipelineProfile(taskDef: TaskDefinition): PipelineProfile {
  // Agent explicit override always wins
  if (taskDef.pipeline_profile && VALID_PIPELINE_PROFILES.includes(taskDef.pipeline_profile)) {
    return taskDef.pipeline_profile
  }

  // When complexity score is available, derive profile from it
  if (taskDef.complexity !== undefined) {
    // Threshold 35 = where spec stage kicks in (the dividing line)
    return taskDef.complexity < STAGE_COMPLEXITY_THRESHOLDS.spec ? 'lightweight' : 'standard'
  }

  // Fallback: legacy heuristic for tasks without complexity score
  if (taskDef.risk_level === 'low' && LIGHTWEIGHT_TASK_TYPES.includes(taskDef.task_type)) {
    return 'lightweight'
  }

  // Everything else gets the full standard pipeline
  return 'standard'
}

type TaskType = (typeof VALID_TASK_TYPES)[number]
type Pipeline = (typeof VALID_PIPELINES)[number]
type PipelineProfile = (typeof VALID_PIPELINE_PROFILES)[number]

// Lightweight tasks: simple fixes that skip heavyweight stages
// Note: implement_feature added for low-risk features (e.g., adding loading/error files)
// that don't need full spec/gap/plan-gap review
const LIGHTWEIGHT_TASK_TYPES: TaskType[] = ['fix_bug', 'refactor', 'ops', 'implement_feature']

export interface TaskDefinition {
  task_type: TaskType
  pipeline: Pipeline
  risk_level: (typeof VALID_RISK_LEVELS)[number]
  confidence: number
  primary_domain: (typeof VALID_DOMAINS)[number]
  scope: string[]
  missing_inputs: Array<{ field: string; question: string }>
  assumptions: string[]
  /** Questions for the reviewer to answer before approving. Derived from assumptions and task ambiguity. */
  review_questions?: string[]
  input_quality?: InputQuality
  pipeline_profile?: (typeof VALID_PIPELINE_PROFILES)[number]
  /** Complexity score (1-100) — determines which pipeline stages run */
  complexity?: number
  /** Brief explanation of complexity scoring breakdown */
  complexity_reasoning?: string
}

// Pipeline consistency: task_type → allowed pipeline values
export const PIPELINE_MAP: Record<TaskType, Pipeline> = {
  spec_only: 'spec_only',
  research: 'spec_only',
  docs: 'spec_only',
  implement_feature: 'spec_execute_verify',
  fix_bug: 'spec_execute_verify',
  refactor: 'spec_execute_verify',
  ops: 'spec_execute_verify',
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

// --- Task type alias mapping (common LLM mistakes) ---

const TASK_TYPE_ALIASES: Record<string, TaskType> = {
  feature: 'implement_feature',
  new_feature: 'implement_feature',
  add_feature: 'implement_feature',
  bug: 'fix_bug',
  bugfix: 'fix_bug',
  bug_fix: 'fix_bug',
  hotfix: 'fix_bug',
  refactoring: 'refactor',
  cleanup: 'refactor',
  documentation: 'docs',
  doc: 'docs',
  operations: 'ops',
  devops: 'ops',
  infra: 'ops',
  spec: 'spec_only',
  research_only: 'research',
  investigate: 'research',
}

// --- Confidence string-to-number mapping ---

const CONFIDENCE_MAP: Record<string, number> = {
  high: 0.9,
  medium: 0.7,
  low: 0.5,
  very_high: 0.95,
  very_low: 0.3,
}

/**
 * Normalize a raw task.json object, fixing common LLM mistakes:
 * - Maps task_type aliases (e.g., "feature" → "implement_feature")
 * - Always derives pipeline from task_type (agent should never set this)
 * - Converts string confidence to number (e.g., "high" → 0.9)
 * - Wraps scope in array if it's a string
 * - Defaults missing arrays
 */
export function normalizeTask(raw: Record<string, unknown>): Record<string, unknown> {
  const data = { ...raw }

  // 1. Normalize task_type aliases
  if (typeof data.task_type === 'string') {
    const alias = TASK_TYPE_ALIASES[data.task_type.toLowerCase()]
    if (alias) {
      data.task_type = alias
    }
  }

  // 2. Always derive pipeline from task_type (never trust agent's value)
  if (VALID_TASK_TYPES.includes(data.task_type as TaskType)) {
    data.pipeline = PIPELINE_MAP[data.task_type as TaskType]
  }

  // 3. Convert string confidence to number
  if (typeof data.confidence === 'string') {
    const mapped = CONFIDENCE_MAP[data.confidence.toLowerCase()]
    if (mapped !== undefined) {
      data.confidence = mapped
    } else {
      // Try parsing as number string (e.g., "0.9")
      const parsed = parseFloat(data.confidence)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        data.confidence = parsed
      }
    }
  }

  // 4. Wrap scope in array if string
  if (typeof data.scope === 'string') {
    data.scope = [data.scope]
  }

  // 5. Default missing arrays
  if (!Array.isArray(data.missing_inputs)) {
    data.missing_inputs = []
  }
  if (!Array.isArray(data.assumptions)) {
    data.assumptions = []
  }
  if (!Array.isArray(data.review_questions)) {
    data.review_questions = []
  }

  // 6. Normalize complexity score
  if (data.complexity !== undefined) {
    if (typeof data.complexity === 'string') {
      const parsed = parseInt(data.complexity as string, 10)
      if (!isNaN(parsed)) {
        data.complexity = parsed
      }
    }
    // Clamp to valid range
    if (typeof data.complexity === 'number') {
      data.complexity = Math.max(
        COMPLEXITY_MIN,
        Math.min(COMPLEXITY_MAX, Math.round(data.complexity)),
      )
    }
  }
  if (typeof data.complexity_reasoning !== 'string' && data.complexity_reasoning !== undefined) {
    data.complexity_reasoning = String(data.complexity_reasoning)
  }

  // 7. Default input_quality if missing (for backward compatibility)
  if (!data.input_quality || typeof data.input_quality !== 'object') {
    data.input_quality = {
      level: 'raw_idea',
      skip_stages: [],
      reasoning: '',
    }
  } else {
    // Ensure input_quality has required fields
    const iq = data.input_quality as Record<string, unknown>
    if (!iq.level) {
      iq.level = 'raw_idea'
    }
    if (!Array.isArray(iq.skip_stages)) {
      iq.skip_stages = []
    }
    if (typeof iq.reasoning !== 'string') {
      iq.reasoning = ''
    }
  }

  return data
}

export function validateTask(raw: unknown): ValidationResult {
  const errors: string[] = []

  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: ['task.json is not a JSON object'] }
  }

  const data = raw as Record<string, unknown>

  // Required fields
  if (!VALID_TASK_TYPES.includes(data.task_type as TaskType)) {
    errors.push(
      `Invalid task_type: "${data.task_type}". Must be one of: ${VALID_TASK_TYPES.join(', ')}`,
    )
  }

  if (!VALID_PIPELINES.includes(data.pipeline as Pipeline)) {
    errors.push(
      `Invalid pipeline: "${data.pipeline}". Must be one of: ${VALID_PIPELINES.join(', ')}`,
    )
  }

  // Validate optional pipeline_profile
  if (data.pipeline_profile !== undefined) {
    if (!VALID_PIPELINE_PROFILES.includes(data.pipeline_profile as PipelineProfile)) {
      errors.push(
        `Invalid pipeline_profile: "${data.pipeline_profile}". Must be one of: ${VALID_PIPELINE_PROFILES.join(', ')}`,
      )
    }
  }

  if (!VALID_RISK_LEVELS.includes(data.risk_level as (typeof VALID_RISK_LEVELS)[number])) {
    errors.push(
      `Invalid risk_level: "${data.risk_level}". Must be one of: ${VALID_RISK_LEVELS.join(', ')}`,
    )
  }

  if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
    errors.push(`Invalid confidence: "${data.confidence}". Must be a number between 0.0 and 1.0`)
  }

  if (!VALID_DOMAINS.includes(data.primary_domain as (typeof VALID_DOMAINS)[number])) {
    errors.push(
      `Invalid primary_domain: "${data.primary_domain}". Must be one of: ${VALID_DOMAINS.join(', ')}`,
    )
  }

  if (!Array.isArray(data.scope)) {
    errors.push(`Invalid scope: must be an array of strings`)
  }

  if (!Array.isArray(data.missing_inputs)) {
    errors.push(`Invalid missing_inputs: must be an array`)
  } else {
    for (const item of data.missing_inputs) {
      const entry = item as Record<string, unknown>
      if (typeof entry.field !== 'string' || typeof entry.question !== 'string') {
        errors.push(`Invalid missing_inputs entry: each must have "field" and "question" strings`)
        break
      }
    }
  }

  if (!Array.isArray(data.assumptions)) {
    errors.push(`Invalid assumptions: must be an array of strings`)
  }

  // Validate review_questions if present
  if (data.review_questions !== undefined) {
    if (!Array.isArray(data.review_questions)) {
      errors.push(`Invalid review_questions: must be an array of strings`)
    } else {
      for (const q of data.review_questions) {
        if (typeof q !== 'string') {
          errors.push(`Invalid review_questions entry: must be an array of strings`)
          break
        }
      }
    }
  }

  // Validate input_quality if present
  if (data.input_quality !== undefined) {
    if (typeof data.input_quality !== 'object' || data.input_quality === null) {
      errors.push(`Invalid input_quality: must be an object`)
    } else {
      const iq = data.input_quality as Record<string, unknown>
      // Validate level
      if (
        !VALID_INPUT_QUALITY_LEVELS.includes(
          iq.level as (typeof VALID_INPUT_QUALITY_LEVELS)[number],
        )
      ) {
        errors.push(
          `Invalid input_quality.level: "${iq.level}". Must be one of: ${VALID_INPUT_QUALITY_LEVELS.join(', ')}`,
        )
      }
      // Validate skip_stages
      if (!Array.isArray(iq.skip_stages)) {
        errors.push(`Invalid input_quality.skip_stages: must be an array`)
      } else {
        for (const stage of iq.skip_stages) {
          if (typeof stage !== 'string') {
            errors.push(`Invalid input_quality.skip_stages: each stage must be a string`)
            break
          }
          // Check for non-skippable stages
          if (NON_SKIPPABLE_STAGES.includes(stage as (typeof NON_SKIPPABLE_STAGES)[number])) {
            errors.push(
              `Cannot skip stage "${stage}" - gap and plan-gap must always run for quality assurance`,
            )
          }
          // Check for unknown stages (optional warning, but we'll be strict)
          if (!SKIPPABLE_STAGES.includes(stage as (typeof SKIPPABLE_STAGES)[number])) {
            // Allow unknown stages but warn - this is informational, not an error
          }
        }
      }
      // Validate reasoning
      if (typeof iq.reasoning !== 'string') {
        errors.push(`Invalid input_quality.reasoning: must be a string`)
      }
    }
  }

  // Validate complexity if present
  if (data.complexity !== undefined) {
    if (typeof data.complexity !== 'number' || !Number.isInteger(data.complexity)) {
      errors.push(`Invalid complexity: "${data.complexity}". Must be an integer`)
    } else if (data.complexity < COMPLEXITY_MIN || data.complexity > COMPLEXITY_MAX) {
      errors.push(
        `Invalid complexity: ${data.complexity}. Must be between ${COMPLEXITY_MIN} and ${COMPLEXITY_MAX}`,
      )
    }
  }

  if (data.complexity_reasoning !== undefined && typeof data.complexity_reasoning !== 'string') {
    errors.push(`Invalid complexity_reasoning: must be a string`)
  }

  // Pipeline consistency check
  if (
    errors.length === 0 &&
    PIPELINE_MAP[data.task_type as TaskType] !== (data.pipeline as Pipeline)
  ) {
    errors.push(
      `Pipeline inconsistency: task_type "${data.task_type}" requires pipeline "${PIPELINE_MAP[data.task_type as TaskType]}", got "${data.pipeline}"`,
    )
  }

  return { valid: errors.length === 0, errors }
}

export function readTask(taskDir: string): TaskDefinition | null {
  const taskFile = path.join(taskDir, 'task.json')
  if (!fs.existsSync(taskFile)) {
    return null
  }

  const content = fs.readFileSync(taskFile, 'utf-8')

  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    const preview = content.slice(0, 200).replace(/\n/g, '\\n')
    throw new Error(
      `task.json is not valid JSON.\n` +
        `  File: ${taskFile}\n` +
        `  Preview: ${preview}\n` +
        `  Common causes:\n` +
        `    • Agent wrapped JSON in markdown code fences\n` +
        `    • Trailing comma in JSON\n` +
        `    • Agent wrote commentary outside the JSON object\n` +
        `  Fix task.json and re-run, or delete it to re-classify:\n` +
        `    rm ${taskFile}`,
    )
  }

  // Normalize common LLM mistakes before validation
  if (typeof raw === 'object' && raw !== null) {
    raw = normalizeTask(raw as Record<string, unknown>)

    // Write back normalized values so subsequent reads are consistent
    fs.writeFileSync(taskFile, JSON.stringify(raw, null, 2) + '\n')
  }

  const result = validateTask(raw)

  if (!result.valid) {
    throw new Error(
      `task.json validation failed:\n${result.errors.map((e) => `  • ${e}`).join('\n')}`,
    )
  }

  return raw as TaskDefinition
}

// --- Stage output file mapping ---

const STAGE_OUTPUT_MAP: Record<string, string> = {
  taskify: 'task.json',
  gap: 'gap.md',
  clarify: 'questions.md',
  architect: 'plan.md',
  'plan-gap': 'plan-gap.md',
  commit: 'commit.md',
  autofix: 'autofix.md',
}

export function stageOutputFile(taskDir: string, stage: string): string {
  const filename = STAGE_OUTPUT_MAP[stage] || `${stage}.md`
  return path.join(taskDir, filename)
}

// --- Pipeline stage definitions ---

export const SPEC_ONLY_STAGES = ['spec', 'gap', 'clarify']

// NOTE: SPEC_EXECUTE_VERIFY_STAGES and ALL_IMPL_STAGES were removed (stale).
// Use IMPL_PIPELINE and ALL_IMPL_STAGE_NAMES instead (defined below).

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
  spec: (taskId) => `# Spec (dry-run)\n\nMock spec for ${taskId}.\n`,
  gap: (taskId) => `# Gap Analysis (dry-run)\n\nNo gaps identified for ${taskId}.\n`,
  clarify: (taskId) => `# Questions (dry-run)\n\n1. Mock question for ${taskId}?\n`,
  architect: (taskId) => `# Plan (dry-run)\n\nMock plan for ${taskId}.\n`,
  build: (taskId) => `# Build (dry-run)\n\nMock build output for ${taskId}.\n`,
  test: (taskId) => `# Test (dry-run)\n\nMock test output for ${taskId}.\n`,
  verify: (taskId) => `# Verify (dry-run)\n\nResult: PASS\n\nMock verification for ${taskId}.\n`,
  auditor: (taskId) => `# Auditor (dry-run)\n\nMock auditor output for ${taskId}.\n`,
  'plan-gap': (taskId) => `# Plan Gap Analysis (dry-run)\n\nNo gaps identified for ${taskId}.\n`,
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

// --- New pipeline stage definitions (with parallel support) ---

/**
 * Implementation pipeline stages with parallel groups.
 *
 * Flow:
 *   architect → plan-gap → build → commit(scripted) →
 *   verify (scripted) → auditor → apply-audit → pr
 * Note: test-writer subagent is invoked by build agent per plan step (TDD)
 */
export const IMPL_PIPELINE: PipelineStage[] = [
  'architect',
  'plan-gap',
  'build',
  'commit',
  { parallel: ['verify', 'auditor'] },
  'apply-audit',
  'pr',
]

/**
 * Flat list of all impl stage names (for validation, rerun, etc.)
 */
export const ALL_IMPL_STAGE_NAMES = flattenPipeline(IMPL_PIPELINE)

// --- Lightweight pipeline variants ---

/**
 * Lightweight implementation pipeline stages.
 *
 * Flow:
 *   architect → build → commit → [verify ‖ auditor] → apply-audit → pr
 *
 * Skipped: plan-gap (saves 1-2 LLM calls)
 * Kept: auditor + apply-audit (quality gate always runs)
 */
export const LIGHTWEIGHT_IMPL_PIPELINE: PipelineStage[] = [
  'architect',
  'build',
  'commit',
  { parallel: ['verify', 'auditor'] },
  'apply-audit',
  'pr',
]

/**
 * Flat list of lightweight impl stage names (for validation, rerun, etc.)
 */
export const ALL_LIGHTWEIGHT_IMPL_STAGE_NAMES = flattenPipeline(LIGHTWEIGHT_IMPL_PIPELINE)

/**
 * Get the implementation pipeline for the given profile.
 */
export function getImplPipeline(profile: 'lightweight' | 'standard'): PipelineStage[] {
  return profile === 'lightweight' ? LIGHTWEIGHT_IMPL_PIPELINE : IMPL_PIPELINE
}

/**
 * Get all flattened stage names for the given profile.
 */
export function getAllImplStageNames(profile: 'lightweight' | 'standard'): string[] {
  return profile === 'lightweight' ? ALL_LIGHTWEIGHT_IMPL_STAGE_NAMES : ALL_IMPL_STAGE_NAMES
}

/**
 * Get spec pipeline stages for the given profile.
 *
 * Standard: taskify → spec → gap [+ clarify]
 * Lightweight: taskify (spec skipped via input_quality, gap dropped)
 */
export function getSpecStagesForProfile(
  profile: 'lightweight' | 'standard',
  clarify: boolean,
): string[] {
  if (profile === 'lightweight') {
    // Lightweight: only taskify runs in spec phase
    // spec is skipped via input_quality (taskify promotes spec.md)
    // gap is dropped entirely
    return clarify ? ['taskify', 'clarify'] : ['taskify']
  }

  // Standard: taskify → spec → gap [+ clarify]
  return clarify ? ['taskify', 'spec', 'gap', 'clarify'] : ['taskify', 'spec', 'gap']
}

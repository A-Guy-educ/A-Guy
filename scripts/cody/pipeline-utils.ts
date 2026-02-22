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

type TaskType = (typeof VALID_TASK_TYPES)[number]
type Pipeline = (typeof VALID_PIPELINES)[number]

export interface TaskDefinition {
  task_type: TaskType
  pipeline: Pipeline
  risk_level: (typeof VALID_RISK_LEVELS)[number]
  confidence: number
  primary_domain: (typeof VALID_DOMAINS)[number]
  scope: string[]
  missing_inputs: Array<{ field: string; question: string }>
  assumptions: string[]
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

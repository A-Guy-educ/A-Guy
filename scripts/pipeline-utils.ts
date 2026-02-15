// pipeline-utils.ts - Shared utilities for pipeline scripts
import * as fs from 'fs'
import * as path from 'path'

// --- Context aggregation ---

const CONTEXT_FILES = [
  'task.md',
  'task.json',
  'spec.md',
  'clarified.md',
  'plan.md',
  'build.md',
  'test.md',
  'verify.md',
  'rerun-feedback.md',
]

export function writeAgentContext(taskDir: string): void {
  const parts: string[] = []
  for (const file of CONTEXT_FILES) {
    const p = path.join(taskDir, file)
    if (fs.existsSync(p)) {
      parts.push(`# ${file}\n\n${fs.readFileSync(p, 'utf-8')}`)
    }
  }
  fs.writeFileSync(path.join(taskDir, '.context.md'), parts.join('\n\n---\n\n'))
}

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
const PIPELINE_MAP: Record<TaskType, Pipeline> = {
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
    console.error(`\n❌ task.json is not valid JSON`)
    console.error(`  File: ${taskFile}`)
    console.error(`  Preview: ${preview}`)
    console.error(`\n  Common causes:`)
    console.error(`    • Agent wrapped JSON in markdown code fences`)
    console.error(`    • Trailing comma in JSON`)
    console.error(`    • Agent wrote commentary outside the JSON object`)
    console.error(`\n  Fix task.json and re-run, or delete it to re-classify:`)
    console.error(`    rm ${taskFile}`)
    process.exit(1)
  }

  const result = validateTask(raw)

  if (!result.valid) {
    console.error('\n❌ task.json validation failed:')
    result.errors.forEach((err) => console.error(`  • ${err}`))
    process.exit(1)
  }

  return raw as TaskDefinition
}

// --- Stage output file mapping ---

const STAGE_OUTPUT_MAP: Record<string, string> = {
  taskify: 'task.json',
  clarify: 'questions.md',
}

export function stageOutputFile(taskDir: string, stage: string): string {
  const filename = STAGE_OUTPUT_MAP[stage] || `${stage}.md`
  return path.join(taskDir, filename)
}

// --- Pipeline stage definitions ---

export const SPEC_ONLY_STAGES = ['spec', 'clarify']
export const SPEC_EXECUTE_VERIFY_STAGES = ['plan', 'build', 'test', 'verify', 'auditor', 'pr']

// All valid stages for rerun
export const ALL_IMPL_STAGES = [...SPEC_EXECUTE_VERIFY_STAGES]

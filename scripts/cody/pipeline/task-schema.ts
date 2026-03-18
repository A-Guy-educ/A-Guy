/**
 * @fileType schema
 * @domain cody | pipeline
 * @pattern task-schema
 * @ai-summary Task definition types, Zod schemas, and validation for the Cody pipeline
 */

import { z } from 'zod'

export const VALID_TASK_TYPES = [
  'spec_only',
  'implement_feature',
  'fix_bug',
  'refactor',
  'docs',
  'ops',
  'research',
] as const

export const VALID_PIPELINES = ['spec_only', 'spec_execute_verify'] as const
const VALID_RISK_LEVELS = ['low', 'medium', 'high'] as const
const VALID_DOMAINS = ['backend', 'frontend', 'infra', 'data', 'llm', 'devops', 'product'] as const
export const VALID_PIPELINE_PROFILES = ['lightweight', 'standard', 'turbo'] as const

export type TaskType = (typeof VALID_TASK_TYPES)[number]
export type Pipeline = (typeof VALID_PIPELINES)[number]
export type PipelineProfile = (typeof VALID_PIPELINE_PROFILES)[number]

export const COMPLEXITY_MIN = 1
export const COMPLEXITY_MAX = 100

// --- Input quality levels for smart stage skipping ---
export const VALID_INPUT_QUALITY_LEVELS = [
  'raw_idea',
  'good_spec',
  'detailed_plan',
  'spec_and_plan',
] as const

// Stages that cannot be skipped (gap analysis always runs)
export const NON_SKIPPABLE_STAGES = ['gap', 'plan-gap', 'build', 'commit', 'verify', 'pr'] as const

// Stages that CAN be skipped when input quality is high
export const SKIPPABLE_STAGES = ['architect'] as const

// NOTE: STAGE_COMPLEXITY_THRESHOLDS moved to stages/registry.ts
// Use getStageComplexityThreshold() from registry instead.

export interface InputQuality {
  level: (typeof VALID_INPUT_QUALITY_LEVELS)[number]
  skip_stages: string[]
  reasoning: string
}

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

export const CONFIDENCE_MAP: Record<string, number> = {
  high: 0.9,
  medium: 0.7,
  low: 0.5,
  very_high: 0.95,
  very_low: 0.3,
}

// --- Zod Schema for TaskDefinition ---

/**
 * Zod schema that validates and normalizes a raw task definition.
 * Uses .superRefine() for validation and .transform() for normalization.
 */
export const TaskDefinitionSchema = z
  .object({
    task_type: z.string().optional(),
    pipeline: z.string().optional(),
    risk_level: z.string().optional(),
    confidence: z.union([z.string(), z.number()]).optional(),
    primary_domain: z.string().optional(),
    scope: z.union([z.string(), z.array(z.string())]).optional(),
    missing_inputs: z.any().optional(),
    assumptions: z.any().optional(),
    review_questions: z.any().optional(),
    input_quality: z.any().optional(),
    pipeline_profile: z.string().optional(),
    complexity: z.union([z.string(), z.number()]).optional(),
    complexity_reasoning: z.any().optional(),
  })
  .superRefine((raw, ctx) => {
    const data = raw as Record<string, unknown>

    // Validate pipeline_profile - add issue on invalid values
    if (data.pipeline_profile !== undefined) {
      if (
        typeof data.pipeline_profile !== 'string' ||
        !VALID_PIPELINE_PROFILES.includes(data.pipeline_profile as PipelineProfile)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid pipeline_profile: "${data.pipeline_profile}". Must be one of: ${VALID_PIPELINE_PROFILES.join(', ')}`,
        })
      }
    }

    // Validate input_quality.skip_stages - add issue for non-skippable stages
    if (
      data.input_quality !== undefined &&
      typeof data.input_quality === 'object' &&
      data.input_quality !== null
    ) {
      const iq = data.input_quality as Record<string, unknown>

      if (Array.isArray(iq.skip_stages)) {
        for (const stage of iq.skip_stages) {
          if (typeof stage !== 'string') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Invalid input_quality.skip_stages: each stage must be a string`,
            })
            break
          }
          if (NON_SKIPPABLE_STAGES.includes(stage as (typeof NON_SKIPPABLE_STAGES)[number])) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Cannot skip stage "${stage}" - gap and plan-gap must always run for quality assurance`,
            })
          }
        }
      }
    }
  })
  .transform((raw): TaskDefinition => {
    const data = raw as Record<string, unknown>

    // 1. Normalize task_type aliases
    let normalizedTaskType: TaskType | undefined
    if (typeof data.task_type === 'string') {
      const alias = TASK_TYPE_ALIASES[data.task_type.toLowerCase()]
      if (alias) {
        normalizedTaskType = alias
      } else if (VALID_TASK_TYPES.includes(data.task_type as TaskType)) {
        normalizedTaskType = data.task_type as TaskType
      } else {
        // Invalid task_type that's not an alias - will be caught in validation
        normalizedTaskType = data.task_type as TaskType
      }
    }

    // 2. Always derive pipeline from task_type
    let normalizedPipeline: Pipeline | undefined
    if (normalizedTaskType && PIPELINE_MAP[normalizedTaskType]) {
      normalizedPipeline = PIPELINE_MAP[normalizedTaskType]
    }

    // 3. Convert string confidence to number
    let normalizedConfidence: number | undefined
    if (typeof data.confidence === 'string') {
      const mapped = CONFIDENCE_MAP[data.confidence.toLowerCase()]
      if (mapped !== undefined) {
        normalizedConfidence = mapped
      } else {
        // Try parsing as number string (e.g., "0.9")
        const parsed = parseFloat(data.confidence)
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          normalizedConfidence = parsed
        }
      }
    } else if (typeof data.confidence === 'number') {
      normalizedConfidence = data.confidence
    }

    // 4. Normalize scope (wrap string in array)
    let normalizedScope: string[] = []
    if (typeof data.scope === 'string') {
      normalizedScope = [data.scope]
    } else if (Array.isArray(data.scope)) {
      normalizedScope = data.scope
    }

    // 5. Default missing arrays
    const missingInputs = Array.isArray(data.missing_inputs)
      ? data.missing_inputs
      : ([] as Array<{ field: string; question: string }>)
    const assumptions = Array.isArray(data.assumptions) ? data.assumptions : []
    const reviewQuestions = Array.isArray(data.review_questions) ? data.review_questions : []

    // 6. Normalize complexity
    let normalizedComplexity: number | undefined
    if (data.complexity !== undefined) {
      if (typeof data.complexity === 'string') {
        const parsed = parseInt(data.complexity, 10)
        if (!isNaN(parsed)) {
          normalizedComplexity = Math.max(
            COMPLEXITY_MIN,
            Math.min(COMPLEXITY_MAX, Math.round(parsed)),
          )
        }
      } else if (typeof data.complexity === 'number') {
        normalizedComplexity = Math.max(
          COMPLEXITY_MIN,
          Math.min(COMPLEXITY_MAX, Math.round(data.complexity)),
        )
      }
    }

    const complexityReasoning =
      typeof data.complexity_reasoning === 'string'
        ? data.complexity_reasoning
        : typeof data.complexity_reasoning !== 'undefined'
          ? String(data.complexity_reasoning)
          : undefined

    // 7. Normalize pipeline_profile (only if valid - validation already done in superRefine)
    let normalizedPipelineProfile: PipelineProfile | undefined
    if (
      data.pipeline_profile !== undefined &&
      typeof data.pipeline_profile === 'string' &&
      VALID_PIPELINE_PROFILES.includes(data.pipeline_profile as PipelineProfile)
    ) {
      normalizedPipelineProfile = data.pipeline_profile as PipelineProfile
    }

    // 8. Normalize input_quality
    let normalizedInputQuality: InputQuality | undefined
    if (
      data.input_quality !== undefined &&
      typeof data.input_quality === 'object' &&
      data.input_quality !== null
    ) {
      const iq = data.input_quality as Record<string, unknown>

      // Validate level
      let level: InputQuality['level'] = 'raw_idea'
      if (
        typeof iq.level === 'string' &&
        VALID_INPUT_QUALITY_LEVELS.includes(iq.level as InputQuality['level'])
      ) {
        level = iq.level as InputQuality['level']
      }

      // Normalize skip_stages (filter out non-skippable - validation done in superRefine)
      const skipStages: string[] = []
      if (Array.isArray(iq.skip_stages)) {
        for (const stage of iq.skip_stages) {
          if (
            typeof stage === 'string' &&
            !NON_SKIPPABLE_STAGES.includes(stage as (typeof NON_SKIPPABLE_STAGES)[number])
          ) {
            skipStages.push(stage)
          }
        }
      }

      const reasoning = typeof iq.reasoning === 'string' ? iq.reasoning : ''

      normalizedInputQuality = { level, skip_stages: skipStages, reasoning }
    } else {
      // Default input_quality
      normalizedInputQuality = {
        level: 'raw_idea',
        skip_stages: [],
        reasoning: '',
      }
    }

    // Build the result object (required fields with defaults for missing)
    const result: TaskDefinition = {
      task_type: normalizedTaskType || 'implement_feature',
      pipeline: normalizedPipeline || 'spec_execute_verify',
      risk_level: (data.risk_level as TaskDefinition['risk_level']) || 'medium',
      confidence: normalizedConfidence ?? 0.7,
      primary_domain: (data.primary_domain as TaskDefinition['primary_domain']) || 'backend',
      scope: normalizedScope,
      missing_inputs: missingInputs as Array<{ field: string; question: string }>,
      assumptions: assumptions as string[],
      review_questions: reviewQuestions as string[] | undefined,
      input_quality: normalizedInputQuality,
      pipeline_profile: normalizedPipelineProfile,
      complexity: normalizedComplexity,
      complexity_reasoning: complexityReasoning,
    }

    return result
  })

/**
 * Parse a raw task definition using Zod schema.
 * Throws descriptive errors on validation failure.
 */
export function parseTaskDefinition(raw: unknown): TaskDefinition {
  const result = TaskDefinitionSchema.safeParse(raw)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.join('.')
      return path ? `${path}: ${issue.message}` : issue.message
    })
    throw new Error(
      `TaskDefinition validation failed:\n${errors.map((e) => `  • ${e}`).join('\n')}`,
    )
  }

  return result.data
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

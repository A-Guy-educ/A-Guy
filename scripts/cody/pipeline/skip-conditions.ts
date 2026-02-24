/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern skip-conditions
 * @ai-summary Pure functions that determine if a stage should be skipped
 */

import * as fs from 'fs'
import * as path from 'path'

import type { PipelineContext, SkipResult } from '../engine/types'

/**
 * Check if stage should be skipped due to input_quality skip_stages
 */
export function skipIfInputQuality(ctx: PipelineContext, stageName: string): SkipResult {
  const taskDef = ctx.taskDef
  if (!taskDef?.input_quality?.skip_stages) {
    return { shouldSkip: false }
  }

  const skipStages = taskDef.input_quality.skip_stages
  if (
    !skipStages.includes(
      stageName as 'spec' | 'gap' | 'clarify' | 'architect' | 'plan-gap' | 'build',
    )
  ) {
    return { shouldSkip: false }
  }

  // Check if promoted file exists
  const outputFile = path.join(ctx.taskDir, `${stageName}.md`)
  if (!fs.existsSync(outputFile)) {
    return { shouldSkip: false }
  }

  return {
    shouldSkip: true,
    reason: `Promoted via input_quality (file exists)`,
  }
}

/**
 * Check if clarify stage should be skipped when --clarify is disabled.
 * Also handles auto-create of clarified.md and cleanup of questions.md.
 */
export function skipIfClarifyDisabled(ctx: PipelineContext): SkipResult {
  // Only applies when clarify is DISABLED
  if (ctx.input.clarify) {
    return { shouldSkip: false }
  }

  const clarifiedPath = path.join(ctx.taskDir, 'clarified.md')

  // Create default clarified.md if it doesn't exist
  if (!fs.existsSync(clarifiedPath)) {
    fs.writeFileSync(clarifiedPath, '# Clarified\n\nUse recommended answers.\n')
  }

  // Clean up residual questions.md from previous clarify-enabled run
  const questionsPath = path.join(ctx.taskDir, 'questions.md')
  if (fs.existsSync(questionsPath)) {
    fs.unlinkSync(questionsPath)
  }

  return { shouldSkip: true, reason: 'Clarify disabled, auto-created clarified.md' }
}

/**
 * Check if auditor stage should be skipped when no auditor output exists
 */
export function skipIfNoAuditorOutput(ctx: PipelineContext): SkipResult {
  const auditorOutput = path.join(ctx.taskDir, 'auditor.md')
  if (!fs.existsSync(auditorOutput)) {
    return { shouldSkip: true, reason: 'No auditor.md (auditor did not complete)' }
  }
  return { shouldSkip: false }
}

/**
 * Check if clarify stage should be skipped when spec has no open questions.
 * ONLY applies when clarify IS enabled (G12).
 */
export function skipIfSpecHasNoOpenQuestions(ctx: PipelineContext): SkipResult {
  // Only applies when clarify IS enabled
  if (!ctx.input.clarify) {
    return { shouldSkip: false }
  }

  const specFile = path.join(ctx.taskDir, 'spec.md')
  if (!fs.existsSync(specFile)) {
    return { shouldSkip: false }
  }

  const specContent = fs.readFileSync(specFile, 'utf-8')
  const hasOpenQuestions = /##\s*Open Questions/i.test(specContent)

  if (!hasOpenQuestions) {
    return { shouldSkip: true, reason: 'Spec has no Open Questions' }
  }

  return { shouldSkip: false }
}

/**
 * Check if impl stages should be skipped for spec_only pipelines
 */
export function skipIfSpecOnly(ctx: PipelineContext): SkipResult {
  const taskDef = ctx.taskDef
  if (taskDef?.pipeline === 'spec_only') {
    return { shouldSkip: true, reason: 'Pipeline is spec_only' }
  }
  return { shouldSkip: false }
}

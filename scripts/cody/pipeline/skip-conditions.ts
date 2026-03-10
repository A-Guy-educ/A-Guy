/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern skip-conditions
 * @ai-summary Pure functions that determine if a stage should be skipped
 */

import * as fs from 'fs'
import * as path from 'path'

import type { PipelineContext, SkipResult } from '../engine/types'
import { STAGE_COMPLEXITY_THRESHOLDS, getComplexityTier } from '../pipeline-utils'

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
      stageName as 'spec' | 'gap' | 'clarify' | 'gsd-research' | 'gsd-plan' | 'gsd-execute',
    )
  ) {
    return { shouldSkip: false }
  }

  // Check if promoted file exists AND has valid content
  // FIX #4: Don't just check existence - validate content is meaningful
  // A stub file from an interrupted run should not cause skip
  const outputFile = path.join(ctx.taskDir, `${stageName}.md`)
  if (!fs.existsSync(outputFile)) {
    return { shouldSkip: false }
  }

  // Validate the file has meaningful content (not just a stub)
  const fileContent = fs.readFileSync(outputFile, 'utf-8').trim()
  const minContentLength = 50 // Minimum meaningful content length

  if (
    fileContent.length < minContentLength ||
    (fileContent.includes('(promoted)') && fileContent.length < 200)
  ) {
    // File is too short or appears to be an incomplete stub
    // Don't skip - let the stage run to regenerate proper content
    return { shouldSkip: false }
  }

  return {
    shouldSkip: true,
    reason: `Promoted via input_quality (valid file exists)`,
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

/**
 * Check if a stage should be skipped based on the task's complexity score.
 * Each stage has a minimum complexity threshold defined in STAGE_COMPLEXITY_THRESHOLDS.
 * If the task's complexity is below the threshold, the stage is skipped.
 *
 * Returns { shouldSkip: false } when:
 *  - No complexity score is set (backward compat — fall through to other skip logic)
 *  - The stage has no threshold (always runs)
 *  - The task's complexity meets or exceeds the threshold
 */
export function skipIfBelowComplexity(ctx: PipelineContext, stageName: string): SkipResult {
  const complexity = ctx.taskDef?.complexity
  // No complexity score → don't skip (backward compatibility)
  if (complexity === undefined) {
    return { shouldSkip: false }
  }

  const threshold = STAGE_COMPLEXITY_THRESHOLDS[stageName]
  // No threshold defined for this stage → don't skip
  if (threshold === undefined || threshold === 0) {
    return { shouldSkip: false }
  }

  if (complexity < threshold) {
    const tier = getComplexityTier(complexity)
    return {
      shouldSkip: true,
      reason: `Complexity ${complexity} (${tier}) below threshold ${threshold} for ${stageName}`,
    }
  }

  return { shouldSkip: false }
}

/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern validators
 * @ai-summary Pipeline validators moved from cody.ts for testability
 */

import * as fs from 'fs'
import * as path from 'path'

import type { PipelineContext, ValidationResult } from '../engine/types'
import {
  validateGapReport,
  validatePlanGapReport,
  validateBuildReport,
  validateSpecContent,
} from '../content-validators'

/**
 * Create a validator for the gap stage.
 * Gap now writes BOTH spec.md and gap.md (spec stage was merged into gap).
 * Validates gap.md format AND ensures spec.md exists with proper structure.
 */
export function createGapValidator(ctx: PipelineContext): (outputFile: string) => ValidationResult {
  return (outputFile: string) => {
    const content = fs.readFileSync(outputFile, 'utf-8')
    if (!validateGapReport(content)) {
      return {
        valid: false,
        error:
          'gap.md must contain ## Gaps Found, ## Changes Made, or "No gaps identified" (you wrote something else)',
      }
    }

    // Validate spec.md was created by gap agent with proper structure
    const specFile = path.join(ctx.taskDir, 'spec.md')
    if (!fs.existsSync(specFile)) {
      return {
        valid: false,
        error:
          'gap agent must write spec.md with ## Requirements or ## Acceptance Criteria sections',
      }
    }

    const specContent = fs.readFileSync(specFile, 'utf-8')
    if (!validateSpecContent(specContent)) {
      return {
        valid: false,
        error: 'spec.md must contain ## Requirements or ## Acceptance Criteria sections',
      }
    }

    return { valid: true }
  }
}

/**
 * Create a validator for the plan-gap stage.
 * Validates plan-gap format AND checks plan.md still exists.
 */
export function createPlanGapValidator(
  ctx: PipelineContext,
): (outputFile: string) => ValidationResult {
  return (outputFile: string) => {
    const content = fs.readFileSync(outputFile, 'utf-8')
    if (!validatePlanGapReport(content)) {
      return {
        valid: false,
        error: 'plan-gap.md must contain ## Gaps Found, ## Changes Made, or "No gaps identified"',
      }
    }

    // Verify plan.md still exists (gap agent shouldn't delete it)
    const planFile = path.join(ctx.taskDir, 'plan.md')
    if (!fs.existsSync(planFile)) {
      return {
        valid: false,
        error: 'plan-gap agent deleted plan.md - it must not delete the plan file',
      }
    }
    return { valid: true }
  }
}

/**
 * Create a validator for the build stage.
 */
export function createBuildValidator(): (outputFile: string) => ValidationResult {
  return (outputFile: string) => {
    const content = fs.readFileSync(outputFile, 'utf-8')
    if (!validateBuildReport(content)) {
      return {
        valid: false,
        error:
          'build.md must contain ## Changes or ## Files section describing what was implemented',
      }
    }
    return { valid: true }
  }
}

/**
 * Create a validator for the docs stage.
 * Validates docs.md was written with minimum content.
 */
export function createDocsValidator(): (outputFile: string) => ValidationResult {
  return (outputFile: string) => {
    if (!fs.existsSync(outputFile)) {
      return {
        valid: false,
        error: 'docs.md must exist in the task directory',
      }
    }
    const content = fs.readFileSync(outputFile, 'utf-8')
    const minLength = 100
    if (content.length < minLength) {
      return {
        valid: false,
        error: `docs.md must have at least ${minLength} characters of content`,
      }
    }
    return { valid: true }
  }
}

/**
 * Create a validator for the reflect stage.
 * Validates reflect.md was written with minimum content.
 */
export function createReflectValidator(): (outputFile: string) => ValidationResult {
  return (outputFile: string) => {
    if (!fs.existsSync(outputFile)) {
      return {
        valid: false,
        error: 'reflect.md must exist in the task directory',
      }
    }
    const content = fs.readFileSync(outputFile, 'utf-8')
    const minLength = 50
    if (content.length < minLength) {
      return {
        valid: false,
        error: `reflect.md must have at least ${minLength} characters of content`,
      }
    }
    return { valid: true }
  }
}

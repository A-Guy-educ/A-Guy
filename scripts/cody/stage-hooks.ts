/**
 * @fileType utility
 * @domain ci | cody
 * @pattern stage-hooks
 * @ai-summary Post-stage hooks for pipeline - extracted from cody.ts for testability
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

import { stageOutputFile } from './pipeline-utils'
import { updateStageStatus } from './cody-utils'
import {
  isPlanReviewFail,
  validateBuildFile,
  extractVerifySummary,
  isVerifyFailed,
} from './content-validators'

// ============================================================================
// Error Types
// ============================================================================

/** Thrown by plan-review gate to signal architect should retry */
export class PlanReviewFailError extends Error {
  constructor() {
    super('Plan review verdict: FAIL')
    this.name = 'PlanReviewFailError'
  }
}

// ============================================================================
// Hook Options
// ============================================================================

export interface StageHookOptions {
  taskId: string
  taskDir: string
  dryRun?: boolean
  isCI?: boolean
}

// ============================================================================
// Post-Stage Hooks
// ============================================================================

/**
 * Handle rerun feedback archive after architect stage.
 * Archives rerun-feedback.md to rerun-feedback.consumed.md
 */
export function handleRerunFeedbackArchive(options: StageHookOptions): void {
  const { taskDir } = options
  const rerunFeedbackPath = path.join(taskDir, 'rerun-feedback.md')

  if (fs.existsSync(rerunFeedbackPath)) {
    const consumed = path.join(taskDir, 'rerun-feedback.consumed.md')
    fs.renameSync(rerunFeedbackPath, consumed)
    console.log(`   Consumed rerun-feedback.md (archived as rerun-feedback.consumed.md)`)
  }
}

/**
 * Handle plan-review gate - check verdict and throw PlanReviewFailError on FAIL
 */
export function handlePlanReviewGate(options: StageHookOptions): void {
  const { taskId, taskDir } = options
  const outputFile = stageOutputFile(taskDir, 'plan-review')

  if (!fs.existsSync(outputFile)) {
    return
  }

  const reviewContent = fs.readFileSync(outputFile, 'utf-8')

  if (isPlanReviewFail(reviewContent)) {
    console.error(`\n❌ Plan review FAILED for ${taskId}`)
    console.error('  The plan does not meet spec requirements. Looping back to architect.\n')

    // Delete plan.md so architect reruns
    const planFile = stageOutputFile(taskDir, 'architect')
    if (fs.existsSync(planFile)) fs.unlinkSync(planFile)

    // Delete plan-review.md so it reruns after new plan
    fs.unlinkSync(outputFile)

    updateStageStatus(taskId, 'plan-review', 'failed', { error: 'Plan review verdict: FAIL' })
    throw new PlanReviewFailError()
  }

  console.log('  ✅ Plan review: PASS')
}

/**
 * Handle build content validation - check for Changes section
 */
export function handleBuildValidation(options: StageHookOptions): void {
  const { taskDir } = options
  const outputFile = stageOutputFile(taskDir, 'build')

  const warning = validateBuildFile(outputFile)
  if (warning) {
    console.warn(`  ⚠️  ${warning}`)
  }
}

/**
 * Handle post-build TypeScript check
 */
export function handlePostBuildTsc(options: StageHookOptions): void {
  const { dryRun } = options

  if (dryRun) {
    return
  }

  try {
    execSync('pnpm -s tsc --noEmit', { cwd: process.cwd(), stdio: 'pipe' })
    console.log('  ✅ Post-build tsc check passed')
  } catch {
    console.error('  ❌ Post-build tsc check failed — code does not compile')
    throw new Error('Build produced code that does not compile. Fix and re-run.')
  }
}

/**
 * Handle verify result - extract summary and return failure info
 */
export interface VerifyFailureInfo {
  failed: boolean
  summary?: ReturnType<typeof extractVerifySummary>
}

export function handleVerifyResult(options: StageHookOptions): VerifyFailureInfo {
  const { taskId, taskDir } = options
  const outputFile = stageOutputFile(taskDir, 'verify')

  if (!fs.existsSync(outputFile)) {
    return { failed: false }
  }

  const verifyContent = fs.readFileSync(outputFile, 'utf-8')

  if (!isVerifyFailed(verifyContent)) {
    return { failed: false }
  }

  const summary = extractVerifySummary(verifyContent)
  console.error(`\n❌ Verification FAILED for ${taskId}`)

  if (summary.typeScriptErrors > 0 || summary.testFailures > 0 || summary.lintErrors > 0) {
    console.error('\n📋 Failure Summary:')
    if (summary.typeScriptErrors > 0) {
      console.error(`  TypeScript: ${summary.typeScriptErrors} error(s)`)
    }
    if (summary.testFailures > 0) {
      console.error(`  Tests: ${summary.testFailures} failure(s)`)
    }
    if (summary.lintErrors > 0) {
      console.error(`  Lint: ${summary.lintErrors} error(s)`)
    }
    if (summary.errorSamples.length > 0) {
      console.error('\n  Sample errors:')
      summary.errorSamples.forEach((err) => console.error(`    - ${err}`))
    }
  }

  return { failed: true, summary }
}

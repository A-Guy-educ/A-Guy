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
import {
  validateBuildFile,
  validateBuildTests,
  extractVerifySummary,
  isVerifyFailed,
  validateGapReport,
} from './content-validators'

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
 * Handle plan-gap validation - verify gap report is valid and plan.md still exists
 */
export function handlePlanGapValidation(options: StageHookOptions): void {
  const { taskDir } = options
  const outputFile = stageOutputFile(taskDir, 'plan-gap')

  if (!fs.existsSync(outputFile)) {
    return // No output file = stage didn't run or was skipped
  }

  const gapContent = fs.readFileSync(outputFile, 'utf-8')
  if (!validateGapReport(gapContent)) {
    throw new Error(
      'Plan gap report is invalid — must contain ## Gaps Found, ## Changes Made, or "No gaps identified"',
    )
  }

  // Re-validate plan.md after gap agent may have revised it
  const planFile = path.join(taskDir, 'plan.md')
  if (!fs.existsSync(planFile)) {
    throw new Error('plan.md missing after plan-gap agent ran — agent may have deleted it')
  }

  console.log('  ✅ Plan gap analysis complete')
}

/**
 * Handle build content validation - check for Changes section and Tests Written
 * Throws an error if build report is missing Changes section
 * For implement_feature/fix_bug task types, also validates Tests Written section exists
 */
export function handleBuildValidation(options: StageHookOptions): void {
  const { taskDir } = options
  const outputFile = stageOutputFile(taskDir, 'build')

  // First validate Changes section (existing check)
  const warning = validateBuildFile(outputFile)
  if (warning) {
    console.error(`  ❌ ${warning}`)
    throw new Error(warning)
  }

  // Also validate Tests Written section
  // Read task.json to get task type
  const taskJsonPath = path.join(taskDir, '..', 'task.json')
  let taskType = 'implement_feature' // default
  if (fs.existsSync(taskJsonPath)) {
    try {
      const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf-8'))
      taskType = taskJson.task_type || 'implement_feature'
    } catch {
      // ignore - use default
    }
  }

  // For implement_feature and fix_bug, tests are required
  const requiresTests = taskType === 'implement_feature' || taskType === 'fix_bug'

  if (fs.existsSync(outputFile)) {
    const buildContent = fs.readFileSync(outputFile, 'utf-8')
    const testsResult = validateBuildTests(buildContent)

    if (requiresTests && !testsResult.hasTests) {
      // For required test types, this is a hard failure
      console.error(`  ❌ ${testsResult.warning} (required for ${taskType})`)
      throw new Error(`Build validation failed: ${testsResult.warning}`)
    } else if (!testsResult.hasTests) {
      // For non-required types (docs, ops, refactor), just warn
      console.log(`  ⚠️  ${testsResult.warning} (optional for ${taskType})`)
    }
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
 * Result from handlePostBuildTests - indicates test execution result
 */
export interface PostBuildTestsResult {
  passed: boolean
  output: string
}

/**
 * Handle post-build unit tests check
 * Runs unit tests to catch failures BEFORE code is committed
 */
export function handlePostBuildTests(options: StageHookOptions): PostBuildTestsResult {
  const { dryRun } = options

  if (dryRun) {
    console.log('  ⏭️  Post-build tests skipped (dry run)')
    return { passed: true, output: '' }
  }

  try {
    execSync('pnpm -s test:unit', {
      cwd: process.cwd(),
      stdio: 'pipe',
      timeout: 180_000, // 3 minute timeout for tests
    })
    console.log('  ✅ Post-build unit tests passed')
    return { passed: true, output: '' }
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    const output = ((err.stdout || '') + (err.stderr || '') + (err.message || '')).slice(0, 3000)
    console.error('  ❌ Post-build unit tests failed')
    return { passed: false, output }
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

#!/usr/bin/env ts-node
/**
 * @fileType script
 * @domain ci | cody
 * @pattern cody-pipeline
 * @ai-summary Central Cody pipeline logic for running multi-agent pipeline in CI via OpenCode GitHub mode
 *
 * Usage:
 *   pnpm cody:run --task-id=<task-id> --mode=<spec|impl|rerun|full|status> [options]
 *
 * This script runs in CI and orchestrates OpenCode agents via `opencode github run`.
 * It handles:
 * - Input parsing and validation
 * - Pipeline stage execution with timeouts and retries (via OIDC auth to GitHub App)
 * - Status tracking (status.json)
 * - Comment posting to GitHub issues
 *
 * Note: opencode github run handles OIDC auth internally via id-token permission.
 * We pass MODEL, AGENT, PROMPT as env vars to control each stage execution.
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

// Import utilities from cody-utils
import {
  parseCliArgs,
  validateAuth,
  ensureTaskDir,
  initStatus,
  updateStageStatus,
  completeStatus,
  readStatus,
  postComment,
  formatStatusComment,
  getIssueBody,
  type CodyInput,
} from './cody-utils'

// Import from pipeline-utils (reusing existing logic)
import {
  writeAgentContext,
  readTask,
  stageOutputFile,
  SPEC_EXECUTE_VERIFY_STAGES,
} from './pipeline-utils'

// Import from new modules
import { runAgentWithFileWatch } from './agent-runner'
import { STAGE_TIMEOUTS, DEFAULT_TIMEOUT } from './agent-runner'
import { ensureFeatureBranch } from './git-utils'
import { createRunner } from './runner-backend'
import { preflight } from './preflight'
import type { RunnerBackend } from './runner-backend'

// ============================================================================
// Main Entry
// ============================================================================

async function main() {
  console.log('=== Cody ===\n')

  // Parse CLI arguments
  let input: CodyInput
  try {
    input = parseCliArgs(process.argv.slice(2))
  } catch (error) {
    console.error('❌ Failed to parse arguments:', error instanceof Error ? error.message : error)
    process.exit(1)
  }

  console.log(`Task: ${input.taskId}`)
  console.log(`Mode: ${input.mode}`)
  console.log(`Dry run: ${input.dryRun}`)
  console.log(`Local: ${input.local}`)
  if (input.issueNumber) console.log(`Issue: #${input.issueNumber}`)
  console.log('')

  // Run preflight checks in local mode
  if (input.local) {
    preflight()
  }

  // Validate GitHub App authentication (skip in local mode)
  if (!input.local) {
    validateAuth()
  }

  // Create runner backend
  const backend = createRunner(input.local)

  // Ensure task directory exists
  ensureTaskDir(input.taskId)

  // Initialize status
  const status = initStatus(input)

  // Route based on mode
  try {
    switch (input.mode) {
      case 'spec':
        await runSpecPipeline(input, status, backend)
        break
      case 'impl':
        await runImplPipeline(input, status, backend)
        break
      case 'full':
        await runFullPipeline(input, status, backend)
        break
      case 'rerun':
        await runRerunPipeline(input, status, backend)
        break
      case 'status':
        await showStatus(input)
        break
      default:
        throw new Error(`Unknown mode: ${input.mode}`)
    }

    completeStatus(input.taskId, 'completed')
    console.log('\n✅ Cody completed successfully')

    if (input.issueNumber) {
      postComment(input.issueNumber, formatStatusComment(input, status))
    }
  } catch (error) {
    completeStatus(input.taskId, 'failed')
    console.error('\n❌ Cody failed:', error instanceof Error ? error.message : error)

    if (input.issueNumber) {
      postComment(
        input.issueNumber,
        `❌ Pipeline failed for \`${input.taskId}\`: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
    process.exit(1)
  }
}

// ============================================================================
// Pipeline Modes
// ============================================================================

async function runSpecPipeline(
  input: CodyInput,
  _status: ReturnType<typeof initStatus>, // Status is updated via updateStageStatus
  backend: RunnerBackend,
): Promise<void> {
  console.log('Running Cody SPEC pipeline (Phase 1)...\n')

  // Ensure task directory exists
  const taskDir = ensureTaskDir(input.taskId)
  const taskMdPath = path.join(taskDir, 'task.md')

  // --file flag: read file content and write it as task.md
  if (input.file) {
    const resolvedFile = path.resolve(input.file)
    if (!fs.existsSync(resolvedFile)) {
      throw new Error(`File not found: ${resolvedFile}`)
    }
    const content = fs.readFileSync(resolvedFile, 'utf-8').trim()
    if (!content) {
      throw new Error(`File is empty: ${resolvedFile}`)
    }
    fs.writeFileSync(taskMdPath, `# Task\n\n${content}\n`)
    console.log(`Created task.md from ${resolvedFile}`)
  }

  // Create task.md from issue body if it doesn't exist
  if (!fs.existsSync(taskMdPath)) {
    if (input.issueNumber) {
      console.log('task.md not found, fetching issue body to create it...')
      const issueBody = getIssueBody(input.issueNumber)
      if (issueBody) {
        fs.writeFileSync(taskMdPath, `# Task\n\n${issueBody}\n`)
        console.log(`Created task.md from issue #${input.issueNumber}`)

        // Comment with assigned task ID
        postComment(
          input.issueNumber,
          `🎯 Task created: \`${input.taskId}\`\n\nCody will now process this task.`,
        )
      } else {
        throw new Error(
          `task.md not found in .tasks/${input.taskId}/ and issue #${input.issueNumber} has no body. Create it first.`,
        )
      }
    } else {
      throw new Error(`task.md not found in .tasks/${input.taskId}/. Create it first.`)
    }
  }

  const stages = ['taskify', 'spec', 'clarify']

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const outputFile = stageOutputFile(taskDir, stage)

    // Skip if output exists (unless this is a re-run)
    if (fs.existsSync(outputFile)) {
      console.log(`[${i + 1}/${stages.length}] ${stage} already exists, skipping`)
      updateStageStatus(input.taskId, stage, 'completed', { outputFile: path.basename(outputFile) })
      continue
    }

    console.log(`[${i + 1}/${stages.length}] Running ${stage}...`)

    // Update status
    updateStageStatus(input.taskId, stage, 'running')

    // Write context
    writeAgentContext(taskDir)

    if (input.dryRun) {
      updateStageStatus(input.taskId, stage, 'completed', { retries: 0 })
      continue
    }

    // Run agent
    const result = await runAgentWithFileWatch(input, stage, outputFile, undefined, { backend })

    if (result.timedOut) {
      updateStageStatus(input.taskId, stage, 'timeout', { retries: result.retries })
      throw new Error(`Stage "${stage}" timed out`)
    }

    if (!result.succeeded) {
      updateStageStatus(input.taskId, stage, 'failed', { retries: result.retries })
      throw new Error(`Stage "${stage}" failed`)
    }

    updateStageStatus(input.taskId, stage, 'completed', {
      retries: result.retries,
      outputFile: path.basename(outputFile),
    })
    console.log(`✓ ${stage} complete`)
  }

  // Create clarified.md if needed (for impl pipeline)
  const clarifiedPath = path.join(taskDir, 'clarified.md')
  if (!fs.existsSync(clarifiedPath)) {
    fs.writeFileSync(clarifiedPath, '# Clarified\n\nUse recommended answers.\n')
  }

  console.log('\n✅ Cody SPEC pipeline complete')
}

async function runImplPipeline(
  input: CodyInput,
  _status: ReturnType<typeof initStatus>, // Status is updated via updateStageStatus
  backend: RunnerBackend,
): Promise<void> {
  console.log('Running Cody IMPLEMENTATION pipeline (Phase 2)...\n')

  const taskDir = ensureTaskDir(input.taskId)

  // Validate clarified.md exists
  const clarifiedPath = path.join(taskDir, 'clarified.md')
  if (!fs.existsSync(clarifiedPath)) {
    throw new Error(`clarified.md not found. Run spec pipeline first or create it.`)
  }

  // Get task definition
  const taskDef = readTask(taskDir)
  if (!taskDef) {
    throw new Error(`task.json not found. Run spec pipeline first.`)
  }

  // Determine stages based on task type
  let stages = [...SPEC_EXECUTE_VERIFY_STAGES]

  // Skip auditor on reruns
  if (fs.existsSync(path.join(taskDir, 'rerun-feedback.md'))) {
    stages = stages.filter((s) => s !== 'auditor')
  }

  // Helper: Commit task files after verify passes (local mode only)
  const commitTaskFiles = (): void => {
    if (!input.local || input.dryRun) return
    try {
      execSync(`git add ${taskDir}`, { cwd: process.cwd(), stdio: 'inherit' })
      execSync(`git commit --no-gpg-sign -m "docs: commit ${input.taskId} task files"`, {
        cwd: process.cwd(),
        stdio: 'inherit',
      })
      console.log(`[commit] Task files committed`)
    } catch {
      console.log(`[commit] No changes to commit (or git error)`)
    }
  }

  // Helper: Extract verify summary
  const extractVerifySummary = (content: string) => {
    const summary = {
      typeScriptErrors: 0,
      testFailures: 0,
      lintErrors: 0,
      errorSamples: [] as string[],
    }

    const tsMatch = content.match(/TypeScript.*?(\d+)\s+error/i)
    if (tsMatch) summary.typeScriptErrors = parseInt(tsMatch[1])

    const testMatch = content.match(/Tests?.*?(\d+)\s+fail/i)
    if (testMatch) summary.testFailures = parseInt(testMatch[1])

    const lintMatch = content.match(/Lint.*?(\d+)\s+error/i)
    if (lintMatch) summary.lintErrors = parseInt(lintMatch[1])

    const lines = content.split('\n')
    for (const line of lines) {
      if (
        (line.trim().startsWith('-') || line.trim().startsWith('•')) &&
        (line.includes('error') || line.includes('Error') || line.includes('✗'))
      ) {
        const cleaned = line.trim().replace(/^[-•]\s*/, '')
        if (cleaned.length > 10 && summary.errorSamples.length < 5) {
          summary.errorSamples.push(cleaned)
        }
      }
    }
    return summary
  }

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const outputFile = stageOutputFile(taskDir, stage)

    // Skip if output exists (not a re-run)
    if (fs.existsSync(outputFile)) {
      console.log(`[${i + 1}/${stages.length}] ${stage} already exists, skipping`)
      updateStageStatus(input.taskId, stage, 'completed', { outputFile: path.basename(outputFile) })
      continue
    }

    console.log(`[${i + 1}/${stages.length}] Running ${stage}...`)

    // Update status
    updateStageStatus(input.taskId, stage, 'running')

    // Write context
    writeAgentContext(taskDir)

    // Set up feature branch before build stage (only in impl pipeline)
    if (stage === 'build' && !input.dryRun) {
      const taskDef = readTask(taskDir)
      if (taskDef) {
        ensureFeatureBranch(input.taskId, taskDef.task_type)
      }
    }

    if (input.dryRun) {
      updateStageStatus(input.taskId, stage, 'completed', { retries: 0 })
      continue
    }

    // Run agent with timeout
    const timeout = STAGE_TIMEOUTS[stage] ?? DEFAULT_TIMEOUT
    const result = await runAgentWithFileWatch(input, stage, outputFile, timeout, { backend })

    if (result.timedOut) {
      updateStageStatus(input.taskId, stage, 'timeout', { retries: result.retries })
      throw new Error(`Stage "${stage}" timed out after ${Math.round(timeout / 60000)} minutes`)
    }

    if (!result.succeeded) {
      updateStageStatus(input.taskId, stage, 'failed', { retries: result.retries })
      throw new Error(`Stage "${stage}" failed after ${result.retries} retries`)
    }

    updateStageStatus(input.taskId, stage, 'completed', {
      retries: result.retries,
      outputFile: path.basename(outputFile),
    })

    // Consume rerun-feedback.md after architect succeeds (prevent re-triggering on retry)
    if (stage === 'architect' && fs.existsSync(path.join(taskDir, 'rerun-feedback.md'))) {
      const consumed = path.join(taskDir, 'rerun-feedback.consumed.md')
      fs.renameSync(path.join(taskDir, 'rerun-feedback.md'), consumed)
      console.log(`   Consumed rerun-feedback.md (archived as rerun-feedback.consumed.md)`)
    }

    // Check verify content for FAIL
    if (stage === 'verify' && fs.existsSync(outputFile)) {
      const content = fs.readFileSync(outputFile, 'utf-8')
      if (/FAIL/i.test(content)) {
        const summary = extractVerifySummary(content)

        console.error(`\n❌ Verification FAILED for ${input.taskId}`)

        if (summary.typeScriptErrors > 0 || summary.testFailures > 0 || summary.lintErrors > 0) {
          console.error('\n📋 Failure Summary:')
          if (summary.typeScriptErrors > 0)
            console.error(`  TypeScript: ${summary.typeScriptErrors} error(s)`)
          if (summary.testFailures > 0) console.error(`  Tests: ${summary.testFailures} failure(s)`)
          if (summary.lintErrors > 0) console.error(`  Lint: ${summary.lintErrors} error(s)`)
          if (summary.errorSamples.length > 0) {
            console.error('\n  Sample errors:')
            summary.errorSamples.forEach((err) => console.error(`    - ${err}`))
          }
        }

        console.error(`\n📄 Full report: ${outputFile}`)
        throw new Error('Verification failed')
      }
      // Commit task files after verify passes
      commitTaskFiles()
    }

    console.log(`✓ ${stage} complete`)
  }

  console.log('\n✅ Cody IMPLEMENTATION pipeline complete')
}

async function runFullPipeline(
  input: CodyInput,
  status: ReturnType<typeof initStatus>,
  backend: RunnerBackend,
): Promise<void> {
  console.log('Running FULL Cody pipeline (spec + impl)...\n')

  // Run spec first
  await runSpecPipeline(input, status, backend)

  // Then impl
  await runImplPipeline(input, status, backend)

  console.log('\n✅ Full Cody pipeline complete!')
}

async function runRerunPipeline(
  input: CodyInput,
  status: ReturnType<typeof initStatus>,
  backend: RunnerBackend,
): Promise<void> {
  console.log('Running Cody RERUN pipeline...\n')

  if (!input.fromStage) {
    input.fromStage = 'build'
  }

  if (!input.feedback) {
    throw new Error('--feedback is required for rerun mode')
  }

  const taskDir = ensureTaskDir(input.taskId)

  // Write feedback file
  const feedbackFile = path.join(taskDir, 'rerun-feedback.md')
  fs.writeFileSync(
    feedbackFile,
    `# Rerun Feedback - ${new Date().toISOString()}\n\n## Issues Found\n\n${input.feedback}\n`,
  )

  console.log(`Feedback: ${input.feedback}`)
  console.log(`From stage: ${input.fromStage}\n`)

  // Delete stage files from rerun point onwards
  const fromIndex = SPEC_EXECUTE_VERIFY_STAGES.indexOf(input.fromStage)
  const stagesToDelete = SPEC_EXECUTE_VERIFY_STAGES.slice(fromIndex)

  for (const stage of stagesToDelete) {
    const stageFile = stageOutputFile(taskDir, stage)
    if (fs.existsSync(stageFile)) {
      fs.unlinkSync(stageFile)
      console.log(`Deleted: ${stage}.md`)
    }
  }

  // Update context
  writeAgentContext(taskDir)

  // Run impl pipeline (it will skip completed stages and re-run from the right point)
  await runImplPipeline(input, status, backend)

  console.log('\n✅ Rerun complete!')
}

async function showStatus(input: CodyInput): Promise<void> {
  const status = readStatus(input.taskId)

  if (!status) {
    console.log(`No status found for task: ${input.taskId}`)
    console.log(`The Cody may not have run yet, or status.json was deleted.`)
    return
  }

  console.log(`Status for ${input.taskId}:`)
  console.log(JSON.stringify(status, null, 2))

  if (input.issueNumber) {
    postComment(input.issueNumber, formatStatusComment(input, status))
  }
}

// ============================================================================
// Execute
// ============================================================================

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

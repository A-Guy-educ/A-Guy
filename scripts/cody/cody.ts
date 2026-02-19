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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if questions.md contains actual questions that need answering
 */
function checkForQuestions(questionsPath: string): boolean {
  const content = fs.readFileSync(questionsPath, 'utf-8').trim()

  // If file is empty or just placeholder text, no questions
  if (!content || content.length < 10) {
    return false
  }

  // Check for question patterns:
  // - Lines starting with numbers followed by period or parenthesis (1. 2. 1) 2))
  // - Lines containing "?" character
  // - Sections like "## Questions" or "### Clarifications Needed"
  const hasNumberedQuestions = /^\d+[.)]\s+/m.test(content)
  const hasQuestionMarks = /\?/.test(content)
  const hasQuestionHeader = /^#{1,3}\s*(Questions|Clarifications|Needs Clarification)/m.test(
    content,
  )

  // Also check for "APPROVED" or "No clarifications needed" as indicators of no questions
  const isApproved = /^#{1,3}\s*APPROVED/im.test(content)
  const noClarifications = /no clarifications needed/i.test(content)

  // Has questions if there's question content AND not explicitly approved
  const hasQuestionContent = hasNumberedQuestions || hasQuestionMarks || hasQuestionHeader

  return hasQuestionContent && !isApproved && !noClarifications
}

/**
 * Extract the answer from a GitHub comment body
 * The comment format is: /cody [command] [task-id] [optional answer text]
 */
function extractAnswerFromComment(commentBody: string): string | null {
  // Decode JSON-encoded body if needed (from jq -Rs .)
  let decoded = commentBody
  if (decoded.startsWith('"') && decoded.endsWith('"')) {
    try {
      decoded = JSON.parse(decoded)
    } catch {
      // Use raw value if JSON.parse fails
    }
  }

  // Normalize literal \n to real newlines
  decoded = decoded.replace(/\\n/g, '\n')

  // Remove /cody prefix and command
  const withoutCody = decoded.replace(/^\/cody\s*/, '').trim()

  // If there's content after the command, treat it as the answer
  if (withoutCody.length > 0) {
    // Remove task-id if present (format: /cody [task-id] or /cody full [task-id])
    const taskIdMatch = withoutCody.match(/^([a-z]+\s+)?([0-9]{6}-[a-z0-9-]+\s*)/i)
    let answer = withoutCody
    if (taskIdMatch) {
      answer = withoutCody.slice(taskIdMatch[0].length).trim()
    }

    // If there's answer content, return it
    if (answer.length > 0) {
      return answer
    }
  }

  return null
}

/**
 * Commit and push task files to the feature branch in CI.
 * This ensures subsequent /cody calls have access to the task state.
 */
function commitTaskFilesCI(input: CodyInput, taskDir: string): void {
  if (input.local || input.dryRun) return

  try {
    // Get task_type from task.json to determine branch prefix
    const taskJsonPath = path.join(taskDir, 'task.json')
    let taskType = 'implement_feature' // default
    if (fs.existsSync(taskJsonPath)) {
      const taskData = JSON.parse(fs.readFileSync(taskJsonPath, 'utf-8'))
      taskType = taskData.task_type || 'implement_feature'
    }

    // Ensure feature branch exists
    ensureFeatureBranch(input.taskId, taskType)

    // Commit task files
    execSync(`git add ${taskDir}`, { cwd: process.cwd(), stdio: 'inherit' })
    execSync(`git commit --no-gpg-sign -m "cody: save task files for ${input.taskId}"`, {
      cwd: process.cwd(),
      stdio: 'inherit',
    })
    execSync(`git push -u origin HEAD`, { cwd: process.cwd(), stdio: 'inherit' })
    console.log('[commit] Task files committed and pushed')
  } catch {
    console.log('[commit] No changes to commit (or git error)')
  }
}

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
  getLatestIssueComment,
  ensureTaskMarkerComment,
  type CodyInput,
} from './cody-utils'

// Import from pipeline-utils (reusing existing logic)
import {
  writeAgentContext,
  readTask,
  stageOutputFile,
  IMPL_PIPELINE,
  ALL_IMPL_STAGE_NAMES,
  isParallelStage,
  type PipelineStage,
} from './pipeline-utils'

// Import from new modules
import { runAgentWithFileWatch } from './agent-runner'
import { STAGE_TIMEOUTS, DEFAULT_TIMEOUT } from './agent-runner'
import { ensureFeatureBranch } from './git-utils'
import { createRunner } from './runner-backend'
import { runVerifyStage, runPrStage } from './scripted-stages'
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

  // Ensure "Task created" marker comment exists on the issue for future discovery.
  // This must run early (before any pipeline mode) so that subsequent /cody calls
  // on the same issue can discover the task-id from the bot comment marker.
  if (input.issueNumber) {
    ensureTaskMarkerComment(input.issueNumber, input.taskId)
  }

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
      // Read fresh status from disk to include all stage info
      const latestStatus = readStatus(input.taskId) || status
      postComment(input.issueNumber, formatStatusComment(input, latestStatus))
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

    // Validate task.json immediately after taskify to catch LLM mistakes early
    if (stage === 'taskify' && fs.existsSync(outputFile)) {
      try {
        readTask(taskDir) // normalizes + validates; writes back corrected values
        console.log('  ✓ task.json validated and normalized')
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`  ❌ task.json invalid after normalization: ${msg}`)
        // Delete invalid file so retry can recreate it
        fs.unlinkSync(outputFile)
        updateStageStatus(input.taskId, stage, 'failed', {
          error: `Invalid task.json: ${msg}`,
        })
        throw new Error(`Taskify produced invalid task.json: ${msg}`)
      }
    }

    console.log(`✓ ${stage} complete`)
  }

  // If questions.md exists and user provided answers (either via comment body or latest issue comment),
  // create clarified.md
  const existingQuestionsPath = path.join(taskDir, 'questions.md')
  if (fs.existsSync(existingQuestionsPath)) {
    let answer: string | null = null

    // Try to get answer from:
    // 1. Comment body (if user wrote "/cody answer text")
    // 2. Latest comment on the issue (plain text answer)
    if (input.commentBody && input.triggerType === 'comment') {
      answer = extractAnswerFromComment(input.commentBody)
    }

    // If no answer from comment body, check latest issue comment
    if (!answer && input.issueNumber && input.triggerType === 'comment') {
      // Get the latest comment (not from bot) as the answer
      answer = getLatestIssueComment(input.issueNumber, 'github-actions[bot]')
    }

    if (answer) {
      const clarifiedPath = path.join(taskDir, 'clarified.md')
      fs.writeFileSync(clarifiedPath, `# Clarified\n\n${answer}\n`)
      console.log('📝 Created clarified.md from user answer\n')
    }
  }

  // Check if there are pending questions from clarify stage
  // Skip if clarified.md already exists (user already answered or was just created above)
  const clarifiedExists = fs.existsSync(path.join(taskDir, 'clarified.md'))
  const questionsPath = path.join(taskDir, 'questions.md')
  const hasQuestions =
    !clarifiedExists && fs.existsSync(questionsPath) && checkForQuestions(questionsPath)

  if (hasQuestions) {
    // Questions exist - stop and ask for clarification
    console.log('\n⚠️ Clarify stage has questions that need answering')
    console.log('Stopping pipeline. Answer the questions and call /cody again to proceed.\n')

    // Post comment asking for clarification
    if (input.issueNumber) {
      const questionsContent = fs.readFileSync(questionsPath, 'utf-8')
      const preview = questionsContent.slice(0, 1500)
      postComment(
        input.issueNumber,
        `🔄 Cody stopped at clarify stage - questions need answering:\n\n${preview}\n\nPlease answer these questions and call \`/cody\` again to proceed with implementation.`,
      )
    }

    // Don't create default clarified.md - let user provide clarifications
    // Stop here - impl pipeline will run on subsequent /cody call
    // Note: Don't call completeStatus here - let main() handle it

    // Commit task files in CI (so next run has state)
    commitTaskFilesCI(input, taskDir)

    console.log('✅ Cody SPEC pipeline complete (waiting for clarification)')
    return
  }

  // No questions - create default clarified.md and proceed
  const clarifiedPath = path.join(taskDir, 'clarified.md')
  if (!fs.existsSync(clarifiedPath)) {
    fs.writeFileSync(clarifiedPath, '# Clarified\n\nUse recommended answers.\n')
  }

  // Commit task files in CI (after spec completes successfully)
  commitTaskFilesCI(input, taskDir)

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

  // Get task definition (readTask now throws on invalid JSON/schema instead of process.exit)
  let taskDef
  try {
    taskDef = readTask(taskDir)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Failed to read task definition: ${msg}`)
    throw new Error(`Invalid task.json: ${msg}`)
  }
  if (!taskDef) {
    throw new Error(`task.json not found. Run spec pipeline first.`)
  }

  // Skip impl stages for spec-only pipelines
  if (taskDef.pipeline === 'spec_only') {
    console.log('Task pipeline is spec_only — skipping implementation stages.')
    return
  }

  // Build the pipeline stages (with parallel support)
  let pipeline: PipelineStage[] = [...IMPL_PIPELINE]

  // Skip auditor on reruns (filter from parallel groups too)
  if (fs.existsSync(path.join(taskDir, 'rerun-feedback.md'))) {
    pipeline = pipeline
      .map((stage) => {
        if (isParallelStage(stage)) {
          const filtered = stage.parallel.filter((s) => s !== 'auditor')
          return filtered.length === 1 ? filtered[0] : { parallel: filtered }
        }
        return stage === 'auditor' ? null : stage
      })
      .filter((s): s is PipelineStage => s !== null)
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

  // Helper: Run a single stage (agent-based or scripted)
  const runSingleStage = async (stage: string): Promise<void> => {
    const outputFile = stageOutputFile(taskDir, stage)

    // Skip if output exists (not a re-run)
    if (fs.existsSync(outputFile)) {
      console.log(`  ${stage} already exists, skipping`)
      updateStageStatus(input.taskId, stage, 'completed', { outputFile: path.basename(outputFile) })
      return
    }

    console.log(`  Running ${stage}...`)
    updateStageStatus(input.taskId, stage, 'running')
    writeAgentContext(taskDir)

    // Set up feature branch before build stage
    if (stage === 'build' && !input.dryRun) {
      const td = readTask(taskDir)
      if (td) {
        ensureFeatureBranch(input.taskId, td.task_type)
      }
    }

    if (input.dryRun) {
      updateStageStatus(input.taskId, stage, 'completed', { retries: 0 })
      return
    }

    // Scripted stages: verify and pr run directly, no LLM needed
    if (stage === 'verify') {
      const verifyResult = runVerifyStage(outputFile)
      if (!verifyResult.passed) {
        updateStageStatus(input.taskId, stage, 'failed', { retries: 0 })
      } else {
        updateStageStatus(input.taskId, stage, 'completed', {
          retries: 0,
          outputFile: path.basename(outputFile),
        })
      }
    } else if (stage === 'pr') {
      const prResult = runPrStage(taskDir, outputFile)
      if (!prResult.url) {
        updateStageStatus(input.taskId, stage, 'failed', { retries: 0 })
        throw new Error('PR creation failed')
      }
      updateStageStatus(input.taskId, stage, 'completed', {
        retries: 0,
        outputFile: path.basename(outputFile),
      })
    } else {
      // Agent-based stages
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
    }

    // Post-stage hooks
    if (stage === 'architect' && fs.existsSync(path.join(taskDir, 'rerun-feedback.md'))) {
      const consumed = path.join(taskDir, 'rerun-feedback.consumed.md')
      fs.renameSync(path.join(taskDir, 'rerun-feedback.md'), consumed)
      console.log(`   Consumed rerun-feedback.md (archived as rerun-feedback.consumed.md)`)
    }

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
      commitTaskFiles()
    }

    console.log(`  ✓ ${stage} complete`)
  }

  // Execute pipeline stages (sequential with parallel group support)
  for (let i = 0; i < pipeline.length; i++) {
    const pipelineStage = pipeline[i]

    if (isParallelStage(pipelineStage)) {
      // Run parallel stages concurrently
      const stageNames = pipelineStage.parallel
      console.log(`[${i + 1}/${pipeline.length}] Running parallel: [${stageNames.join(', ')}]...`)
      await Promise.all(stageNames.map((s) => runSingleStage(s)))
      console.log(`✓ parallel group [${stageNames.join(', ')}] complete`)
    } else {
      // Run sequential stage
      console.log(`[${i + 1}/${pipeline.length}] ${pipelineStage}`)
      await runSingleStage(pipelineStage)
    }
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

  // Check if spec stopped for questions (clarified.md won't exist)
  const clarifiedPath = path.join(ensureTaskDir(input.taskId), 'clarified.md')
  if (!fs.existsSync(clarifiedPath)) {
    console.log('\n⏸️ Spec pipeline stopped for clarification. Skipping impl.')
    return
  }

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
  const fromIndex = ALL_IMPL_STAGE_NAMES.indexOf(input.fromStage)
  const stagesToDelete = ALL_IMPL_STAGE_NAMES.slice(fromIndex)

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

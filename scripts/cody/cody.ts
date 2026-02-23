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

import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// Pipeline Paused Signal
// ============================================================================

/**
 * Thrown when the pipeline intentionally pauses (e.g. hard-stop / risk gate).
 * Caught in main() to post a ⏸️ comment instead of ✅ completed.
 */
class PipelinePausedError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'PipelinePausedError'
  }
}

// Import from extracted modules
import { validateSpecContent } from './content-validators'
import type { ValidationResult } from './agent-runner'
import { validateGapReport, validatePlanGapReport, validateBuildReport } from './content-validators'
import { handleClarification, handleGateApproval } from './clarify-workflow'
import { commitPipelineFiles } from './git-utils'
import {
  handleRerunFeedbackArchive,
  handlePlanGapValidation,
  handleBuildValidation,
  handlePostBuildTsc,
  handlePostBuildTests,
  handleVerifyResult,
} from './stage-hooks'

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
  getIssue,
  ensureTaskMarkerComment,
  getLastFailedStage,
  extractGateCommentBody,
  type CodyInput,
} from './cody-utils'

// Import from pipeline-utils (reusing existing logic)
import {
  readTask,
  stageOutputFile,
  isParallelStage,
  flattenPipeline,
  type PipelineStage,
  resolveControlMode,
  resolvePipelineProfile,
  getSpecStagesForProfile,
  getImplPipeline,
  getAllImplStageNames,
} from './pipeline-utils'

// Import from new modules
import { runAgentWithFileWatch } from './agent-runner'
import { STAGE_TIMEOUTS, DEFAULT_TIMEOUT } from './agent-runner'
import { ensureFeatureBranch } from './git-utils'
import { createRunner } from './runner-backend'
import { runVerifyStage, runCommitStage, runPrStage } from './scripted-stages'
import { preflight } from './preflight'
import type { RunnerBackend } from './runner-backend'
import { setGlobalContext } from './logger'

/**
 * Get a content validator for a specific stage.
 * Returns a function that validates the stage's output file, or undefined if no validation needed.
 * The validator runs inside the agent retry loop - if validation fails, the agent retries with feedback.
 */
function getStageValidator(
  stage: string,
  taskDir: string,
): ((outputFile: string) => ValidationResult) | undefined {
  switch (stage) {
    case 'spec':
      return (outputFile: string) => {
        const content = fs.readFileSync(outputFile, 'utf-8')
        if (validateSpecContent(content)) {
          return { valid: true }
        }
        return {
          valid: false,
          error: 'spec.md must contain ## Requirements or ## Acceptance Criteria sections',
        }
      }

    case 'gap':
      return (outputFile: string) => {
        const content = fs.readFileSync(outputFile, 'utf-8')
        if (!validateGapReport(content)) {
          return {
            valid: false,
            error:
              'gap.md must contain ## Gaps Found, ## Changes Made, or "No gaps identified" (you wrote something else)',
          }
        }
        // Also validate spec wasn't corrupted by gap agent
        const specFile = path.join(taskDir, 'spec.md')
        if (fs.existsSync(specFile)) {
          const specContent = fs.readFileSync(specFile, 'utf-8')
          if (!validateSpecContent(specContent)) {
            return {
              valid: false,
              error:
                'gap agent corrupted spec.md - it must keep ## Requirements or ## Acceptance Criteria sections',
            }
          }
        }
        return { valid: true }
      }

    case 'plan-gap':
      return (outputFile: string) => {
        const content = fs.readFileSync(outputFile, 'utf-8')
        if (!validatePlanGapReport(content)) {
          return {
            valid: false,
            error:
              'plan-gap.md must contain ## Gaps Found, ## Changes Made, or "No gaps identified"',
          }
        }
        // Verify plan.md still exists (gap agent shouldn't delete it)
        const planFile = path.join(taskDir, 'plan.md')
        if (!fs.existsSync(planFile)) {
          return {
            valid: false,
            error: 'plan-gap agent deleted plan.md - it must not delete the plan file',
          }
        }
        return { valid: true }
      }

    case 'build':
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

    default:
      return undefined
  }
}

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

  // Set global logging context for structured logging
  setGlobalContext({ taskId: input.taskId, runId: input.runId })

  // Set up signal handlers for graceful shutdown when CI runner kills the process
  // This ensures status.json is updated to "failed" instead of being left stuck at "running"
  const currentTaskId = input.taskId
  const cleanupOnSignal = (signal: string) => {
    console.error(`\n⚠ Received ${signal} — CI runner shutting down`)
    if (currentTaskId) {
      try {
        completeStatus(currentTaskId, 'failed')
        console.error(`  Updated status.json to "failed" for task ${currentTaskId}`)
      } catch (err) {
        console.error(`  Failed to update status:`, err)
      }
    }
    process.exit(128 + (signal === 'SIGTERM' ? 15 : 2))
  }

  process.on('SIGTERM', () => cleanupOnSignal('SIGTERM'))
  process.on('SIGINT', () => cleanupOnSignal('SIGINT'))

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
    ensureTaskMarkerComment(input.issueNumber, input.taskId, input.mode, input.runUrl)
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
    if (error instanceof PipelinePausedError) {
      completeStatus(input.taskId, 'paused')
      console.log(`\n⏸️ Cody paused: ${error.message}`)
      // Gate comment was already posted by the gate handler — no duplicate needed
      return
    }

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
      const { body: issueBody, title: issueTitle } = getIssue(input.issueNumber)
      if (issueBody) {
        // Include issue title for better PR titles later
        const titleSection = issueTitle ? `## Issue Title\n\n${issueTitle}\n` : ''
        fs.writeFileSync(taskMdPath, `# Task\n\n${titleSection}${issueBody}\n`)
        console.log(
          `Created task.md from issue #${input.issueNumber}${issueTitle ? ` (title: "${issueTitle}")` : ''}`,
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

  // Clarify stage: only run if --clarify flag is set (opt-in)
  // Default: skip, auto-create clarified.md with "Use recommended answers"
  // Gap stage runs between spec and clarify to analyze and revise spec
  // Start with just taskify — remaining stages determined after taskify produces task.json
  const stages = ['taskify']

  // Cache for input_quality skip_stages (populated after taskify runs)
  let skipStages: string[] = []

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const outputFile = stageOutputFile(taskDir, stage)

    // After taskify runs, cache skip_stages from task.json for subsequent stages
    if (stage !== 'taskify' && skipStages.length === 0) {
      const taskDef = readTask(taskDir)
      if (taskDef?.input_quality?.skip_stages) {
        skipStages = taskDef.input_quality.skip_stages
        console.log(`  ℹ️ Input quality: skipping stages ${JSON.stringify(skipStages)}`)
      }
    }

    // Check if stage should be skipped due to input_quality
    if (stage !== 'taskify' && skipStages.includes(stage)) {
      // Verify the promoted file exists (taskify should have written it)
      if (fs.existsSync(outputFile)) {
        console.log(`[${i + 1}/${stages.length}] ${stage} skipped — promoted via input_quality`)
        updateStageStatus(input.taskId, stage, 'completed', {
          outputFile: path.basename(outputFile),
          skipped: 'input_quality',
        })
        continue
      } else {
        // Promoted file missing - fall back to running the stage normally
        console.log(`[${i + 1}/${stages.length}] ${stage}: promoted file missing, running anyway`)
        skipStages = [] // Clear so we don't keep trying to skip
      }
    }

    // Skip if output exists (unless this is a re-run)
    if (fs.existsSync(outputFile)) {
      console.log(`[${i + 1}/${stages.length}] ${stage} already exists, skipping`)
      updateStageStatus(input.taskId, stage, 'completed', { outputFile: path.basename(outputFile) })
      continue
    }

    // Skip clarify if spec has no open questions (only when clarify is enabled)
    if (stage === 'clarify' && input.clarify) {
      const specFile = path.join(taskDir, 'spec.md')
      if (fs.existsSync(specFile)) {
        const specContent = fs.readFileSync(specFile, 'utf-8')
        const hasOpenQuestions = /##\s*Open Questions/i.test(specContent)
        if (!hasOpenQuestions) {
          console.log(`[${i + 1}/${stages.length}] ${stage} skipped — spec has no Open Questions`)
          updateStageStatus(input.taskId, stage, 'completed', { retries: 0 })
          continue
        }
      }
    }

    console.log(`[${i + 1}/${stages.length}] Running ${stage}...`)

    // Update status
    updateStageStatus(input.taskId, stage, 'running')

    // Write context

    if (input.dryRun) {
      updateStageStatus(input.taskId, stage, 'completed', { retries: 0 })
      continue
    }

    // Run agent
    const validator = getStageValidator(stage, taskDir)
    const result = await runAgentWithFileWatch(input, stage, outputFile, undefined, {
      backend,
      validateOutput: validator,
    })

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
      let taskDefAfterTaskify: ReturnType<typeof readTask> | undefined
      try {
        taskDefAfterTaskify = readTask(taskDir) // normalizes + validates; writes back corrected values
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

      // GATE: Hard-stop check - pause after taskify for high-risk tasks
      if (taskDefAfterTaskify) {
        const controlMode = resolveControlMode(taskDefAfterTaskify, input.controlMode)
        if (controlMode === 'hard-stop') {
          console.log('  [STOP] Hard-stop gate: task is high-risk, awaiting approval...')
          const gateResult = handleGateApproval(input, taskDir, 'taskify', taskDefAfterTaskify)
          if (gateResult === 'waiting') {
            // Post gate comment to issue
            const gateFilePath = path.join(taskDir, 'gate-taskify.md')
            if (fs.existsSync(gateFilePath)) {
              const gateContent = fs.readFileSync(gateFilePath, 'utf-8')
              if (input.issueNumber) {
                const commentBody = extractGateCommentBody(gateContent)
                if (commentBody) {
                  postComment(input.issueNumber, commentBody)
                }
              }
            }
            // Commit task files and pause
            commitPipelineFiles({
              taskDir,
              taskId: input.taskId,
              message: `ci(cody): pause at hard-stop gate for ${input.taskId}`,
              ensureBranch: true,
              stagingStrategy: 'task-only',
              push: true,
              isCI: !input.local,
              dryRun: input.dryRun,
            })
            console.log('⏸️ Hard-stop: awaiting approval before proceeding')
            throw new PipelinePausedError(`hard-stop gate: awaiting approval for ${input.taskId}`)
          }
          if (gateResult === 'rejected') {
            throw new Error('Task rejected by user at hard-stop gate')
          }
          // 'approved' → continue
          console.log('  ✅ Hard-stop: approved, proceeding...')
        }
      }

      // Resolve pipeline profile from task.json after taskify completes
      const taskDef = readTask(taskDir)
      const profile = taskDef ? resolvePipelineProfile(taskDef) : 'standard'

      // Log pipeline profile for observability
      if (profile === 'lightweight') {
        console.log(
          `  ℹ️ Pipeline profile: lightweight (spec promoted by taskify, gap/plan-gap/auditor/apply-audit skipped)`,
        )
      } else {
        console.log(`  ℹ️ Pipeline profile: standard (full pipeline)`)
      }

      // Determine remaining spec stages based on profile
      const remainingStages = getSpecStagesForProfile(profile, input.clarify ?? false).filter(
        (s) => s !== 'taskify',
      )
      stages.push(...remainingStages)
      console.log(`  ℹ️ Spec stages: ${stages.join(' → ')}`)
    }

    console.log(`✓ ${stage} complete`)
  }

  // Handle clarification workflow using extracted module
  const clarifyResult = handleClarification(input, taskDir)

  if (clarifyResult === 'answered') {
    console.log('📝 Created clarified.md from user answer\n')
  }

  if (clarifyResult === 'waiting') {
    // Questions exist - stop and ask for clarification
    console.log('\n⚠️ Clarify stage has questions that need answering')
    console.log('Stopping pipeline. Answer the questions and call /cody again to proceed.\n')

    // Post comment asking for clarification
    const questionsPath = path.join(taskDir, 'questions.md')
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
    commitPipelineFiles({
      taskDir,
      taskId: input.taskId,
      message: `ci(cody): Save task files for ${input.taskId}\n\nAuto-committed by Cody pipeline`,
      ensureBranch: true,
      cleanDirtyState: true,
      stagingStrategy: 'task-only',
      push: true,
      isCI: !input.local,
      dryRun: input.dryRun,
    })

    console.log('✅ Cody SPEC pipeline complete (waiting for clarification)')
    throw new PipelinePausedError(`clarify stage: awaiting answers for ${input.taskId}`)
  }

  // Commit task files in CI (after spec completes successfully)
  commitPipelineFiles({
    taskDir,
    taskId: input.taskId,
    message: `ci(cody): Save task files for ${input.taskId}\n\nAuto-committed by Cody pipeline`,
    ensureBranch: true,
    cleanDirtyState: true,
    stagingStrategy: 'task-only',
    push: true,
    isCI: !input.local,
    dryRun: input.dryRun,
  })

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

  // Resolve pipeline profile and get appropriate pipeline
  const profile = resolvePipelineProfile(taskDef)
  const pipeline: PipelineStage[] = getImplPipeline(profile)
  console.log(`ℹ️ Pipeline profile: ${profile} (${flattenPipeline(pipeline).join(' → ')})`)

  // Cache for input_quality skip_stages (populated on first stage check)
  let implSkipStages: string[] = []

  // Helper to check and cache skip stages for impl pipeline
  const checkImplSkipStages = (stage: string): boolean => {
    if (implSkipStages.length === 0) {
      const taskDef = readTask(taskDir)
      if (taskDef?.input_quality?.skip_stages) {
        implSkipStages = taskDef.input_quality.skip_stages
        console.log(`  ℹ️ Input quality (impl): skipping stages ${JSON.stringify(implSkipStages)}`)
      }
    }
    return implSkipStages.includes(stage)
  }

  // Note: Auditor now runs on reruns too - failures during retries are valuable for improvement
  // The auditor checks for duplicates via audit-history.json to avoid re-auditing same findings

  // Helper: Commit task files after verify passes (local mode only)
  const commitTaskFiles = (): void => {
    if (!input.local || input.dryRun) return
    commitPipelineFiles({
      taskDir,
      taskId: input.taskId,
      message: `docs: commit ${input.taskId} task files`,
      stagingStrategy: 'task-only',
      push: false,
      dryRun: input.dryRun,
    })
  }

  // Helper: Commit audit history changes after apply-audit stage (local mode only)
  const commitAuditHistory = (): void => {
    if (!input.local || input.dryRun) return
    const auditHistoryPath = path.join(process.cwd(), '.tasks', 'audit-history.json')
    if (fs.existsSync(auditHistoryPath)) {
      commitPipelineFiles({
        taskDir: '.tasks',
        taskId: 'audit-history',
        message: `audit: update audit history from ${input.taskId}`,
        stagingStrategy: 'task-only',
        push: false,
        dryRun: input.dryRun,
      })
    }
  }

  // Helper: Run a single stage (agent-based or scripted)
  const runSingleStage = async (stage: string): Promise<void> => {
    const outputFile = stageOutputFile(taskDir, stage)

    // Check if stage should be skipped due to input_quality
    if (checkImplSkipStages(stage)) {
      if (fs.existsSync(outputFile)) {
        console.log(`  ${stage} skipped — promoted via input_quality`)
        updateStageStatus(input.taskId, stage, 'completed', {
          outputFile: path.basename(outputFile),
          skipped: 'input_quality',
        })
        return
      } else {
        // Promoted file missing - fall back to running the stage normally
        console.log(`  ${stage}: promoted file missing, running anyway`)
        implSkipStages = [] // Clear so we don't keep trying to skip
      }
    }

    // Skip if output exists (not a re-run)
    if (fs.existsSync(outputFile)) {
      console.log(`  ${stage} already exists, skipping`)
      updateStageStatus(input.taskId, stage, 'completed', { outputFile: path.basename(outputFile) })
      return
    }

    // Skip apply-audit if auditor.md doesn't exist (auditor didn't complete)
    // This handles cases where auditor failed/timeout but verify passed
    if (stage === 'apply-audit') {
      const auditorOutput = path.join(taskDir, 'auditor.md')
      if (!fs.existsSync(auditorOutput)) {
        console.log(`  ${stage} skipped — no auditor.md (auditor did not complete)`)
        updateStageStatus(input.taskId, stage, 'completed', { skipped: 'no_auditor_output' })
        return
      }
    }

    console.log(`  Running ${stage}...`)
    updateStageStatus(input.taskId, stage, 'running')
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

    // Scripted stages: verify, commit, and pr run directly, no LLM needed
    if (stage === 'verify') {
      const verifyTimeout = STAGE_TIMEOUTS[stage] ?? DEFAULT_TIMEOUT
      const verifyResult = runVerifyStage(outputFile, undefined, verifyTimeout)
      if (!verifyResult.passed) {
        updateStageStatus(input.taskId, stage, 'failed', { retries: 0 })
      } else {
        updateStageStatus(input.taskId, stage, 'completed', {
          retries: 0,
          outputFile: path.basename(outputFile),
        })
      }
    } else if (stage === 'commit') {
      const commitResult = runCommitStage(taskDir, outputFile)
      if (!commitResult.success && !commitResult.message.includes('No changes')) {
        updateStageStatus(input.taskId, stage, 'failed', { retries: 0 })
        throw new Error(`Commit failed: ${commitResult.message}`)
      }
      updateStageStatus(input.taskId, stage, 'completed', {
        retries: 0,
        outputFile: path.basename(outputFile),
      })
    } else if (stage === 'pr') {
      const prResult = runPrStage(taskDir, outputFile, process.cwd(), input.issueNumber)
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
      const validator = getStageValidator(stage, taskDir)
      const result = await runAgentWithFileWatch(input, stage, outputFile, timeout, {
        backend,
        validateOutput: validator,
      })

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
    const hookOptions = { taskId: input.taskId, taskDir, dryRun: input.dryRun, isCI: !input.local }

    // Rerun feedback archive
    if (stage === 'architect') {
      handleRerunFeedbackArchive(hookOptions)

      // GATE: Risk-gated or hard-stop check - pause after architect for medium/high risk tasks
      const taskDefAfterArchitect = readTask(taskDir)
      if (taskDefAfterArchitect) {
        const controlMode = resolveControlMode(taskDefAfterArchitect, input.controlMode)
        if (controlMode === 'risk-gated' || controlMode === 'hard-stop') {
          console.log(`  [GATE] ${controlMode} gate: pausing for approval after architect...`)
          // Read plan content for the gate comment
          const planPath = path.join(taskDir, 'plan.md')
          const planContent = fs.existsSync(planPath)
            ? fs.readFileSync(planPath, 'utf-8')
            : undefined
          const gateResult = handleGateApproval(
            input,
            taskDir,
            'architect',
            taskDefAfterArchitect,
            planContent,
          )
          if (gateResult === 'waiting') {
            // Post gate comment to issue
            const gateFilePath = path.join(taskDir, 'gate-architect.md')
            if (fs.existsSync(gateFilePath) && input.issueNumber) {
              const gateContent = fs.readFileSync(gateFilePath, 'utf-8')
              const commentBody = extractGateCommentBody(gateContent)
              if (commentBody) {
                postComment(input.issueNumber, commentBody)
              }
            }
            // Commit task files and pause
            commitPipelineFiles({
              taskDir,
              taskId: input.taskId,
              message: `ci(cody): pause at ${controlMode} gate for ${input.taskId}`,
              ensureBranch: true,
              stagingStrategy: 'task-only',
              push: true,
              isCI: !input.local,
              dryRun: input.dryRun,
            })
            console.log(`⏸️ ${controlMode}: awaiting approval before build`)
            throw new PipelinePausedError(
              `${controlMode} gate: awaiting approval for ${input.taskId}`,
            )
          }
          if (gateResult === 'rejected') {
            throw new Error(`Task rejected by user at ${controlMode} gate`)
          }
          // 'approved' → continue
          console.log('  ✅ Gate: approved, proceeding to build...')
        }
      }
    }

    // Plan-gap validation: verify gap report is valid
    if (stage === 'plan-gap') {
      handlePlanGapValidation(hookOptions)
    }

    // Build content validation + tsc check + unit tests gate
    if (stage === 'build') {
      handleBuildValidation(hookOptions)
      handlePostBuildTsc(hookOptions)

      // Pre-commit test gate: catch test failures BEFORE committing code
      // This is critical for catching test logic errors (like vi.mock hoisting issues)
      // that the autofix agent cannot fix
      const testResult = handlePostBuildTests(hookOptions)
      if (!testResult.passed) {
        // Tests failed - throw error to fail the pipeline
        // This will trigger supervisor retry with test error feedback
        throw new Error(`Unit tests failed after build. Fix and re-run.\n\n${testResult.output}`)
      }
    }

    // Verify failure check (autofix loop kept inline)
    if (stage === 'verify' && fs.existsSync(outputFile)) {
      const verifyResult = handleVerifyResult(hookOptions)
      if (verifyResult.failed) {
        // Auto-fix loop: attempt to fix lint/type/format errors automatically
        const MAX_AUTOFIX_ATTEMPTS = 2
        let fixed = false

        for (let attempt = 1; attempt <= MAX_AUTOFIX_ATTEMPTS; attempt++) {
          console.log(`\n🔧 Auto-fix attempt ${attempt}/${MAX_AUTOFIX_ATTEMPTS}...`)

          // Run autofix agent
          const autofixOutput = stageOutputFile(taskDir, 'autofix')
          // Remove previous autofix output if any
          if (fs.existsSync(autofixOutput)) fs.unlinkSync(autofixOutput)

          updateStageStatus(input.taskId, 'autofix', 'running')

          if (!input.dryRun) {
            const autofixTimeout = STAGE_TIMEOUTS['autofix'] ?? DEFAULT_TIMEOUT
            const autofixResult = await runAgentWithFileWatch(
              input,
              'autofix',
              autofixOutput,
              autofixTimeout,
              { backend },
            )

            if (!autofixResult.succeeded) {
              console.error(`  ❌ Autofix agent failed (attempt ${attempt})`)
              updateStageStatus(input.taskId, 'autofix', 'failed', {
                retries: autofixResult.retries,
              })
              continue
            }
            updateStageStatus(input.taskId, 'autofix', 'completed', {
              retries: autofixResult.retries,
              outputFile: path.basename(autofixOutput),
            })
          }

          // Re-run verify after autofix
          console.log('  Re-running verification...')
          if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile)

          const reVerify = runVerifyStage(outputFile)
          if (reVerify.passed) {
            console.log(`  ✅ Verification passed after autofix attempt ${attempt}`)
            updateStageStatus(input.taskId, 'verify', 'completed', {
              retries: 0,
              outputFile: path.basename(outputFile),
            })
            fixed = true
            break
          } else {
            console.error(`  ❌ Verification still failing after autofix attempt ${attempt}`)
            updateStageStatus(input.taskId, 'verify', 'failed', { retries: 0 })
          }
        }

        if (!fixed) {
          console.error(
            `\n❌ Auto-fix exhausted ${MAX_AUTOFIX_ATTEMPTS} attempts. Pipeline failed.`,
          )
          console.error(`📄 Full report: ${outputFile}`)
          throw new Error('Verification failed after auto-fix attempts')
        }

        // Commit autofix changes — the commit agent already ran before verify,
        // so autofix changes would be lost without this explicit commit
        const autofixResult = commitPipelineFiles({
          taskDir,
          taskId: input.taskId,
          message: `fix: Autofix corrections for ${input.taskId}\n\nApply automated lint, type, and format fixes`,
          stagingStrategy: 'tracked+task',
          push: true,
          dryRun: input.dryRun,
        })

        if (autofixResult.success) {
          if (autofixResult.committed) {
            console.log('  ✅ Autofix changes committed and pushed')
          } else {
            console.log('  ⚠ No autofix changes to commit')
          }
        } else if (!autofixResult.message.includes('No changes')) {
          // Push failure means remote won't have the fixes — fail the pipeline
          console.error(`  ❌ Failed to commit/push autofix changes: ${autofixResult.message}`)
          throw new Error('Autofix changes could not be pushed — remote branch is stale')
        }
      }
      commitTaskFiles()
    }

    // Commit task files and audit history after apply-audit stage completes
    if (stage === 'apply-audit') {
      commitTaskFiles()
      commitAuditHistory()
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
      const results = await Promise.allSettled(stageNames.map((s) => runSingleStage(s)))

      // Distinguish between CRITICAL and ADVISORY stage failures
      // - CRITICAL (verify): pipeline cannot continue without passing quality gates
      // - ADVISORy (auditor): advisory only, can proceed even if it fails
      const ADVISORY_STAGES = new Set(['auditor'])
      const criticalFailures: { name: string; reason: string }[] = []
      const advisoryFailures: { name: string; reason: string }[] = []

      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'rejected') {
          const name = stageNames[j]
          const reason =
            (results[j] as PromiseRejectedResult).reason?.message ||
            String((results[j] as PromiseRejectedResult).reason)
          if (ADVISORY_STAGES.has(name)) {
            advisoryFailures.push({ name, reason })
            console.warn(`  ⚠ Advisory stage "${name}" failed (non-fatal): ${reason}`)
          } else {
            criticalFailures.push({ name, reason })
          }
        }
      }

      // Only throw if a CRITICAL stage failed
      if (criticalFailures.length > 0) {
        const errors = criticalFailures.map((f) => f.reason).join('; ')
        const failedNames = criticalFailures.map((f) => f.name)
        throw new Error(`Parallel stages [${failedNames.join(', ')}] failed: ${errors}`)
      }

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

  // Run spec first — throws PipelinePausedError if stopped at a gate or clarify stage
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

  const taskDir = ensureTaskDir(input.taskId)

  // Check if spec artifacts exist — if not, fall back to full pipeline
  const specPath = path.join(taskDir, 'spec.md')
  if (!fs.existsSync(specPath)) {
    console.log('No spec.md found — falling back to full pipeline')
    await runFullPipeline({ ...input, mode: 'full' }, status, backend)
    return
  }

  if (!input.fromStage) {
    input.fromStage = getLastFailedStage(input.taskId) || 'build'
  }

  // Default feedback if not provided (e.g., from implicit feedback in comment)
  if (!input.feedback) {
    input.feedback = 'Rerun requested via /cody rerun'
  }

  // Write feedback file
  const feedbackFile = path.join(taskDir, 'rerun-feedback.md')
  fs.writeFileSync(
    feedbackFile,
    `# Rerun Feedback - ${new Date().toISOString()}\n\n## Issues Found\n\n${input.feedback}\n`,
  )

  console.log(`Feedback: ${input.feedback}`)
  console.log(`From stage: ${input.fromStage}\n`)

  // Resolve pipeline profile for profile-aware rerun
  const taskDef = readTask(taskDir)
  const profile = taskDef ? resolvePipelineProfile(taskDef) : 'standard'
  const stageNames = getAllImplStageNames(profile)
  console.log(`ℹ️ Pipeline profile: ${profile} (rerun)`)

  // Normalize fromStage: handle special sub-stages that aren't in ALL_IMPL_STAGE_NAMES
  // autofix is a sub-stage of verify, so treat it as starting from verify
  let normalizedFromStage = input.fromStage
  if (normalizedFromStage === 'autofix') {
    console.log('  Note: autofix is a sub-stage of verify, rerunning from verify')
    normalizedFromStage = 'verify'
  }

  // Delete stage files from rerun point onwards
  let fromIndex = stageNames.indexOf(normalizedFromStage)
  // Handle unknown stages - default to start of pipeline
  if (fromIndex === -1) {
    console.log(
      `  Warning: Unknown stage "${normalizedFromStage}", defaulting to start from architect`,
    )
    fromIndex = 0
    normalizedFromStage = stageNames[0]
  }
  const stagesToDelete = stageNames.slice(fromIndex)

  for (const stage of stagesToDelete) {
    const stageFile = stageOutputFile(taskDir, stage)
    if (fs.existsSync(stageFile)) {
      fs.unlinkSync(stageFile)
      console.log(`Deleted: ${stage}.md`)
    }
  }

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

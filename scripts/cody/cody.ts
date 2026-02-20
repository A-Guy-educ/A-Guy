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

// Import from extracted modules
import { validateSpecContent } from './content-validators'
import { handleClarification } from './clarify-workflow'
import { commitPipelineFiles } from './git-utils'
import {
  PlanReviewFailError,
  handleRerunFeedbackArchive,
  handlePlanReviewGate,
  handleBuildValidation,
  handlePostBuildTsc,
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
  getIssueBody,
  getLatestIssueComment,
  ensureTaskMarkerComment,
  type CodyInput,
} from './cody-utils'

// Import from pipeline-utils (reusing existing logic)
import {
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
import { runVerifyStage, runCommitStage, runPrStage } from './scripted-stages'
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

  // Clarify stage: only run if --clarify flag is set (opt-in)
  // Default: skip, auto-create clarified.md with "Use recommended answers"
  const stages = input.clarify ? ['taskify', 'spec', 'clarify'] : ['taskify', 'spec']

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const outputFile = stageOutputFile(taskDir, stage)

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

    // Spec content validation: must contain requirements or acceptance criteria
    if (stage === 'spec' && fs.existsSync(outputFile)) {
      const specContent = fs.readFileSync(outputFile, 'utf-8')
      if (!validateSpecContent(specContent)) {
        // Delete the bad spec so it can be regenerated
        fs.unlinkSync(outputFile)
        updateStageStatus(input.taskId, stage, 'failed', {
          error: 'Spec missing Requirements or Acceptance Criteria sections',
        })
        throw new Error(
          'Spec is missing ## Requirements or ## Acceptance Criteria — cannot proceed to architect',
        )
      }
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
      message: `ci(cody): save task files for ${input.taskId}\n\nAuto-committed by Cody pipeline`,
      ensureBranch: true,
      cleanDirtyState: true,
      stagingStrategy: 'task-only',
      push: true,
      isCI: !input.local,
      dryRun: input.dryRun,
    })

    console.log('✅ Cody SPEC pipeline complete (waiting for clarification)')
    return
  }

  // Commit task files in CI (after spec completes successfully)
  commitPipelineFiles({
    taskDir,
    taskId: input.taskId,
    message: `ci(cody): save task files for ${input.taskId}\n\nAuto-committed by Cody pipeline`,
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
    commitPipelineFiles({
      taskDir,
      taskId: input.taskId,
      message: `docs: commit ${input.taskId} task files`,
      stagingStrategy: 'task-only',
      push: false,
      dryRun: input.dryRun,
    })
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
    const hookOptions = { taskId: input.taskId, taskDir, dryRun: input.dryRun, isCI: !input.local }

    // Rerun feedback archive
    if (stage === 'architect') {
      handleRerunFeedbackArchive(hookOptions)
    }

    // Plan-review gate: check verdict and fail pipeline on FAIL
    if (stage === 'plan-review') {
      handlePlanReviewGate(hookOptions)
    }

    // Build content validation + tsc check
    if (stage === 'build') {
      handleBuildValidation(hookOptions)
      handlePostBuildTsc(hookOptions)
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
          message: `fix: autofix corrections for ${input.taskId}`,
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
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failures.length > 0) {
        const failedNames = stageNames.filter((_, i) => results[i].status === 'rejected')
        const errors = failures.map((f) => f.reason?.message || String(f.reason)).join('; ')
        throw new Error(`Parallel stages [${failedNames.join(', ')}] failed: ${errors}`)
      }
      console.log(`✓ parallel group [${stageNames.join(', ')}] complete`)
    } else {
      // Run sequential stage
      console.log(`[${i + 1}/${pipeline.length}] ${pipelineStage}`)
      try {
        await runSingleStage(pipelineStage)
      } catch (err) {
        // Plan-review retry loop: if plan-review fails, re-run architect + plan-review (max 2 retries)
        if (err instanceof PlanReviewFailError) {
          const MAX_PLAN_RETRIES = 2
          let planFixed = false

          for (let planAttempt = 1; planAttempt <= MAX_PLAN_RETRIES; planAttempt++) {
            console.log(
              `\n🔄 Plan review retry ${planAttempt}/${MAX_PLAN_RETRIES}: re-running architect...`,
            )
            await runSingleStage('architect')

            console.log(`  Re-running plan-review...`)
            try {
              await runSingleStage('plan-review')
              planFixed = true
              break
            } catch (retryErr) {
              if (retryErr instanceof PlanReviewFailError) {
                console.error(
                  `  Plan review still failing (attempt ${planAttempt}/${MAX_PLAN_RETRIES})`,
                )
                continue
              }
              throw retryErr // Non plan-review error, propagate
            }
          }

          if (!planFixed) {
            throw new Error(
              `Plan review failed after ${MAX_PLAN_RETRIES} retries — pipeline stopped`,
            )
          }
        } else {
          throw err // Non plan-review error, propagate
        }
      }
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

  const taskDir = ensureTaskDir(input.taskId)

  // Check if spec artifacts exist — if not, fall back to full pipeline
  const specPath = path.join(taskDir, 'spec.md')
  if (!fs.existsSync(specPath)) {
    console.log('No spec.md found — falling back to full pipeline')
    input.mode = 'full'
    await runFullPipeline(input, status, backend)
    return
  }

  if (!input.fromStage) {
    input.fromStage = 'build'
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

  // Normalize fromStage: handle special sub-stages that aren't in ALL_IMPL_STAGE_NAMES
  // autofix is a sub-stage of verify, so treat it as starting from verify
  let normalizedFromStage = input.fromStage
  if (normalizedFromStage === 'autofix') {
    console.log('  Note: autofix is a sub-stage of verify, rerunning from verify')
    normalizedFromStage = 'verify'
  }

  // Delete stage files from rerun point onwards
  let fromIndex = ALL_IMPL_STAGE_NAMES.indexOf(normalizedFromStage)
  // Handle unknown stages - default to start of pipeline
  if (fromIndex === -1) {
    console.log(
      `  Warning: Unknown stage "${normalizedFromStage}", defaulting to start from architect`,
    )
    fromIndex = 0
    normalizedFromStage = ALL_IMPL_STAGE_NAMES[0]
  }
  const stagesToDelete = ALL_IMPL_STAGE_NAMES.slice(fromIndex)

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

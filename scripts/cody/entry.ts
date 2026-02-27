/**
 * @fileType script
 * @domain cody
 * @pattern entry-point
 * @ai-summary New CLI entry point for Cody pipeline state machine
 */

import * as fs from 'fs'
import * as path from 'path'

import {
  parseCliArgs,
  validateAuth,
  ensureTaskDir,
  getLastFailedStage,
  getLastPausedStage,
} from './cody-utils'
import { preflight } from './preflight'
import { createRunner } from './runner-backend'
import { setGlobalContext } from './logger'
import { handleClarification } from './clarify-workflow'
import { commitPipelineFiles } from './git-utils'
import { stageOutputFile, readTask } from './pipeline-utils'

import type { PipelineContext } from './engine/types'
import { runPipeline } from './engine/state-machine'
import { resolvePipelineForMode, createRebuildCallback } from './engine/pipeline-resolver'
import { flattenPipelineOrder, IMPL_ORDER_STANDARD } from './pipeline/definitions'
import { stateToV1 } from './engine/status'
import { PipelinePausedError } from './engine/types'
import { resolveRerunFromStage } from './rerun-utils'
import { ensureTaskMarkerComment, postComment } from './github-api'
import { formatStatusComment } from './cody-utils'

// ============================================================================
// Shared Helpers
// ============================================================================

/**
 * R4: Extract task.md preparation logic into a shared helper.
 * Ensures task.md exists before pipeline runs (needed for taskify agent).
 */
async function ensureTaskMd(ctx: PipelineContext): Promise<void> {
  const { input, taskDir } = ctx
  const taskMdPath = path.join(taskDir, 'task.md')

  // --file flag has priority
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
    return
  }

  // Create task.md from issue body if it doesn't exist
  if (!fs.existsSync(taskMdPath)) {
    if (input.issueNumber) {
      const { getIssue } = await import('./github-api')
      console.log('task.md not found, fetching issue body to create it...')
      const { body: issueBody, title: issueTitle } = getIssue(input.issueNumber)
      if (issueBody) {
        const titleSection = issueTitle ? `## Issue Title\n\n${issueTitle}\n` : ''
        fs.writeFileSync(taskMdPath, `# Task\n\n${titleSection}${issueBody}\n`)
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
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Handle --help early
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Cody Pipeline CLI

Usage: pnpm tsx scripts/cody/entry.ts [options]

Options:
  --task-id <id>         Task ID (format: YYMMDD-description)
  --mode <mode>          Pipeline mode: full, spec, impl, rerun, clarify, status
  --file <path>          Path to task file (auto-generates task-id from filename)
  --dry-run              Dry run mode
  --issue-number <n>     GitHub issue number
  --trigger-type         Trigger type: dispatch, comment
  --run-id <id>          CI run ID
  --run-url <url>        CI run URL
  --comment-body <text>  Comment body (for comment triggers)
  --from <stage>         Stage to restart from (for rerun mode)
  --feedback <text>      Feedback for rerun mode
  --auto                 Auto mode (non-interactive)
  --gate                 Risk-gated mode (require approval)
  --hard-stop            Hard stop on failure
  --local                Run in local mode (skip GitHub API)
  --clarify              Run clarify stage

Examples:
  pnpm tsx scripts/cody/entry.ts --task-id 260225-my-task --mode full
  pnpm tsx scripts/cody/entry.ts --file docs/feature.md
  pnpm tsx scripts/cody/entry.ts --mode rerun --from verify --feedback "Tests failed"
`)
    return
  }

  // Parse CLI args
  const input = parseCliArgs(args)

  // Post "started" comment with run URL at the beginning of the pipeline
  if (input.issueNumber && input.runUrl) {
    postComment(
      input.issueNumber,
      `🚀 Cody started for \`${input.taskId}\` (mode: ${input.mode})\n\nRun: ${input.runUrl}`,
    )
  }

  // Set global logging context
  setGlobalContext({ taskId: input.taskId, runId: input.runId })

  // R9: Shutdown guard to prevent double-execution on SIGTERM/SIGINT
  let shuttingDown = false
  // G2: Signal handlers with null guard
  const cleanupOnSignal = async (signal: string) => {
    // Prevent double execution
    if (shuttingDown) return
    shuttingDown = true
    console.error(`\n⚠ Received ${signal} — CI runner shutting down`)
    try {
      const { loadState, completeState, writeState } = await import('./engine/status')
      const state = loadState(input.taskId)
      if (state) {
        const failedState = completeState(state, 'failed')
        writeState(input.taskId, failedState)
        console.error(`  Updated status.json to "failed" for task ${input.taskId}`)
      }
    } catch (err) {
      console.error(`  Failed to update status:`, err)
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

  // Ensure task directory
  const taskDir = ensureTaskDir(input.taskId)

  // G3: Ensure task marker comment runs for ALL modes before the mode switch
  if (input.issueNumber) {
    ensureTaskMarkerComment(input.issueNumber, input.taskId, input.mode, input.runUrl)
  }

  // Pre-pipeline setup per mode
  const ctx: PipelineContext = {
    taskId: input.taskId,
    taskDir,
    input,
    taskDef: null,
    profile: 'standard',
    backend,
  }

  try {
    switch (input.mode) {
      case 'spec':
        await runSpecMode(ctx)
        break
      case 'impl':
        await runImplMode(ctx)
        break
      case 'full':
        await runFullMode(ctx)
        break
      case 'rerun':
        await runRerunMode(ctx)
        break
      case 'status':
        await runStatusMode(ctx)
        break
      default:
        throw new Error(`Unknown mode: ${input.mode}`)
    }
  } catch (error) {
    if (error instanceof PipelinePausedError) {
      // Pipeline paused - handled internally
      return
    }

    // G6: process.exit(1) on failure
    // Only update status if state exists and isn't already marked as failed
    // (runPipeline already marks and writes state before throwing)
    const { writeState, loadState: loadSt, completeState } = await import('./engine/status')
    const existingState = loadSt(input.taskId)
    if (existingState && existingState.state !== 'failed') {
      const failedState = completeState(existingState, 'failed')
      writeState(input.taskId, failedState)
    }

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

/**
 * Spec mode setup
 */
async function runSpecMode(ctx: PipelineContext): Promise<void> {
  const { input, taskDir } = ctx

  // R4: Ensure task.md exists before running pipeline
  await ensureTaskMd(ctx)

  // Run spec pipeline
  const pipeline = resolvePipelineForMode('spec', 'standard', input.clarify ?? false, ctx)
  await runPipeline(ctx, pipeline)

  // G17: Post-spec clarification logic
  if (input.clarify) {
    const clarifyResult = handleClarification(input, taskDir)
    if (clarifyResult === 'waiting') {
      console.log('\n⚠️ Clarify stage has questions that need answering')
      const questionsPath = path.join(taskDir, 'questions.md')
      if (input.issueNumber) {
        const questionsContent = fs.readFileSync(questionsPath, 'utf-8')
        const preview = questionsContent.slice(0, 1500)
        postComment(
          input.issueNumber,
          `🔄 Cody stopped at clarify stage - questions need answering:\n\n${preview}\n\nPlease answer these questions and call \`/cody\` again to proceed with implementation.`,
        )
      }
      // Commit task files and pause
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
      throw new PipelinePausedError(`clarify stage: awaiting answers for ${input.taskId}`)
    }
  }

  // Commit spec task files
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

/**
 * Impl mode setup
 */
async function runImplMode(ctx: PipelineContext): Promise<void> {
  const { taskDir } = ctx

  // Validate clarified.md exists
  const clarifiedPath = path.join(taskDir, 'clarified.md')
  if (!fs.existsSync(clarifiedPath)) {
    throw new Error(`clarified.md not found. Run spec pipeline first or create it.`)
  }

  // Get task definition
  let taskDef
  try {
    taskDef = readTask(taskDir)
    ctx.taskDef = taskDef
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Failed to read task definition: ${msg}`)
    throw new Error(`Invalid task.json: ${msg}`)
  }
  if (!taskDef) {
    throw new Error(`task.json not found. Run spec pipeline first.`)
  }

  // Check spec_only pipeline
  if (taskDef.pipeline === 'spec_only') {
    console.log('Task pipeline is spec_only — skipping implementation stages.')
    return
  }

  // Resolve profile
  const { resolvePipelineProfile } = await import('./pipeline-utils')
  ctx.profile = resolvePipelineProfile(taskDef)
  console.log(`ℹ️ Pipeline profile: ${ctx.profile}`)

  // Run impl pipeline (pass rebuild callback for two-phase construction)
  const pipeline = resolvePipelineForMode('impl', ctx.profile, false, ctx)
  const rebuild = createRebuildCallback('full', ctx.input.clarify ?? false)
  await runPipeline(ctx, pipeline, undefined, rebuild)

  console.log('\n✅ Cody IMPLEMENTATION pipeline complete')
}

/**
 * Full mode setup
 */
async function runFullMode(ctx: PipelineContext): Promise<void> {
  console.log('Running FULL Cody pipeline (spec + impl)...\n')

  // R4: Ensure task.md exists before running pipeline
  await ensureTaskMd(ctx)

  // Run full pipeline with rebuild callback for two-phase construction
  // This uses buildPipeline('full') which includes both spec and impl stages
  const pipeline = resolvePipelineForMode('full', 'standard', ctx.input.clarify ?? false, ctx)
  const rebuild = createRebuildCallback('full', ctx.input.clarify ?? false)
  const finalState = await runPipeline(ctx, pipeline, undefined, rebuild)

  // Handle paused state (gate approval required)
  if (finalState.state === 'paused') {
    throw new PipelinePausedError(`Pipeline paused — awaiting gate approval for ${ctx.taskId}`)
  }

  console.log('\n✅ Full Cody pipeline complete!')
}

/**
 * Rerun mode setup
 */
async function runRerunMode(ctx: PipelineContext): Promise<void> {
  const { input, taskDir } = ctx
  console.log('Running Cody RERUN pipeline...\n')

  // G33: Check for paused stage FIRST - if we're resuming from a gate approval,
  // we should continue even if spec.md doesn't exist (it may not have been created yet
  // because the gate paused before resolve-profile post-action ran)
  const pausedStage = !input.fromStage ? getLastPausedStage(input.taskId) : null

  // G33: Fallback to full only if spec.md missing AND no paused stage to resume
  const specPath = path.join(taskDir, 'spec.md')
  if (!fs.existsSync(specPath) && !pausedStage) {
    console.log('No spec.md found — falling back to full pipeline')
    input.mode = 'full'
    await runFullMode(ctx)
    return
  }

  // FIX #5: Check for paused stage first (gate approval scenario)
  // This handles the case where @cody approve was used to resume a paused pipeline
  if (pausedStage) {
    console.log(`Detected paused stage: ${pausedStage}`)

    // Try to approve the gate directly
    try {
      const taskDef = readTask(taskDir)
      if (taskDef) {
        const { handleGateApproval } = await import('./clarify-workflow')
        const gateResult = handleGateApproval(input, taskDir, pausedStage, taskDef)

        if (gateResult === 'approved') {
          console.log(`Gate ${pausedStage} approved — resuming pipeline`)

          // Write approved file to cache approval for future runs
          const approvedPath = path.join(taskDir, `gate-${pausedStage}-approved.md`)
          fs.writeFileSync(
            approvedPath,
            `# Gate Approved\n\nApproved at ${pausedStage} gate.\nApproved via @cody approve command.\n`,
          )

          // Commit and push the approval file so subsequent runs can find it
          const { commitPipelineFiles } = await import('./git-utils')
          await commitPipelineFiles({
            taskDir,
            taskId: input.taskId,
            message: `ci(cody): gate ${pausedStage} approved for ${input.taskId}`,
            ensureBranch: true,
            stagingStrategy: 'task-only',
            push: true,
            isCI: !input.local,
            dryRun: input.dryRun,
          })

          // Mark the paused stage as completed in status
          const { loadState, writeState } = await import('./engine/status')
          const state = loadState(input.taskId)
          if (state?.stages?.[pausedStage]) {
            state.stages[pausedStage].state = 'completed'
            // Also reset pipeline state from 'paused' to 'running' so state machine continues
            state.state = 'running'
            delete state.completedAt
            writeState(input.taskId, state)
          }

          // After approving a spec-phase gate, continue with the rerun pipeline
          // The rerun pipeline already includes both spec and impl stages
          // No mode switch needed - just continue running
        } else if (gateResult === 'waiting') {
          console.log(`Gate ${pausedStage} still waiting for approval`)
        }
      }
    } catch (err) {
      console.warn('Could not handle gate approval:', err)
    }
  }

  // Determine fromStage (use paused stage if detected, otherwise failed stage, otherwise build)
  if (!input.fromStage) {
    input.fromStage = pausedStage || getLastFailedStage(input.taskId) || 'build'
  }

  // P3 fix: Back up to architect when feedback provided so plan can be revised
  const implStageOrder = flattenPipelineOrder(IMPL_ORDER_STANDARD)
  const resolvedFrom = resolveRerunFromStage(
    input.fromStage || 'build',
    input.feedback,
    implStageOrder,
  )
  if (resolvedFrom !== input.fromStage) {
    console.log(
      `  ℹ️ Feedback provided — backing up from ${input.fromStage} to ${resolvedFrom} for plan revision`,
    )
    input.fromStage = resolvedFrom
  }

  // Default feedback
  if (!input.feedback) {
    input.feedback = 'Rerun requested via /cody rerun'
  }

  // G37: Write feedback file
  const feedbackFile = path.join(taskDir, 'rerun-feedback.md')
  fs.writeFileSync(
    feedbackFile,
    `# Rerun Feedback - ${new Date().toISOString()}\n\n## Issues Found\n\n${input.feedback}\n`,
  )

  console.log(`Feedback: ${input.feedback}`)
  console.log(`From stage: ${input.fromStage}\n`)

  // G37: Read task definition for profile resolution
  // Fix 4: Wrap in try/catch to handle missing/invalid task.json gracefully
  let taskDef = null
  try {
    taskDef = readTask(taskDir)
  } catch {
    console.warn('Could not read task.json for profile resolution, using default')
  }
  ctx.taskDef = taskDef
  if (taskDef) {
    const { resolvePipelineProfile } = await import('./pipeline-utils')
    ctx.profile = resolvePipelineProfile(taskDef)
  }

  // For rerun, we need to delete the files manually since the engine won't do it
  // The status.ts resetFromStage handles this but we need to call it
  // R3: Use dynamic stage order from pipeline definition instead of hardcoded array
  const pipeline = resolvePipelineForMode('rerun', ctx.profile, false, ctx)
  const stageOrder = flattenPipelineOrder(pipeline.order)

  // Fix 5: Validate fromStage exists in the resolved pipeline order
  const fromStage = input.fromStage || 'build'
  if (!stageOrder.includes(fromStage)) {
    throw new Error(
      `Stage "${fromStage}" not found in rerun pipeline. Valid stages: ${stageOrder.join(', ')}`,
    )
  }

  const { loadState, resetFromStage, writeState } = await import('./engine/status')
  const state = loadState(input.taskId)
  if (state) {
    // Get stages to delete from
    const fromIndex = stageOrder.indexOf(fromStage)
    if (fromIndex >= 0) {
      const stagesToDelete = stageOrder.slice(fromIndex)
      for (const stage of stagesToDelete) {
        const outputFile = stageOutputFile(taskDir, stage)
        if (fs.existsSync(outputFile)) {
          fs.unlinkSync(outputFile)
          console.log(`Deleted: ${stage}.md`)
        }
      }
    }

    // Reset stages in status
    const newState = resetFromStage(state, fromStage, stageOrder, taskDir)
    writeState(input.taskId, newState)
  }

  // Run impl pipeline
  await runPipeline(ctx, pipeline)

  console.log('\n✅ Rerun complete!')
}

/**
 * Status mode
 */
async function runStatusMode(ctx: PipelineContext): Promise<void> {
  const { input } = ctx
  const { loadState } = await import('./engine/status')

  const state = loadState(input.taskId)

  if (!state) {
    console.log(`No status found for task: ${input.taskId}`)
    console.log(`The Cody may not have run yet, or status.json was deleted.`)
    return
  }

  console.log(`Status for ${input.taskId}:`)
  console.log(JSON.stringify(state, null, 2))

  if (input.issueNumber) {
    const v1Status = stateToV1(state)
    postComment(input.issueNumber, formatStatusComment(input, v1Status))
  }
}

// Run main
main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

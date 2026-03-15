/**
 * @fileType script
 * @domain cody
 * @pattern entry-point
 * @ai-summary New CLI entry point for Cody pipeline state machine
 */

// Load .env before anything else so GH_PAT, API keys, etc. are available.
// In CI, environment variables are injected by the workflow — this is a no-op
// if .env doesn't exist (dotenv silently skips missing files).
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })

import * as fs from 'fs'
import ms from 'ms'
import * as path from 'path'

import {
  parseCliArgs,
  validateAuth,
  ensureTaskDir,
  getTaskDir,
  getLastFailedStage,
  getLastPausedStage,
} from './cody-utils'
import { preflight } from './preflight'
import { createRunner } from './runner-backend'
import { logger, createStageLogger } from './logger'
import { handleClarification } from './clarify-workflow'
import { commitPipelineFiles, mergeDefaultBranch } from './git-utils'
import { readTask } from './pipeline-utils'

import type { PipelineContext } from './engine/types'
import { runPipeline } from './engine/state-machine'
import { resolvePipelineForMode, createRebuildCallback } from './engine/pipeline-resolver'
import { flattenPipelineOrder } from './pipeline/definitions'
import { stateToV1, resetFromStage } from './engine/status'
import { PipelinePausedError } from './engine/types'
import {
  resolveRerunFromStage,
  resolveFromStageAfterGateApproval,
  findNearestEarlierStage,
} from './rerun-utils'
import { startServer, stopServer, checkpointDb, findLastSessionId } from './opencode-server'
import type { OpenCodeServer } from './opencode-server'
import {
  ensureTaskMarkerComment,
  postComment,
  getLinkedIssueFromPR,
  getIssueBody,
  discoverTaskIdFromIssue,
} from './github-api'
import { formatStatusComment } from './cody-utils'

// ============================================================================
// OpenCode Server Lifecycle
// ============================================================================

/** Module-level reference to the OpenCode server for cleanup in signal handlers */
let openCodeServer: OpenCodeServer | null = null

/**
 * Gracefully shut down the OpenCode server, checkpoint the DB, and clear the reference.
 * Safe to call multiple times (idempotent).
 */
async function shutdownOpenCodeServer(taskDir?: string): Promise<void> {
  if (!openCodeServer) return
  const server = openCodeServer
  openCodeServer = null

  await stopServer(server)

  // Checkpoint WAL into main DB so it's self-contained for git commits
  if (taskDir) {
    checkpointDb(taskDir)
  }
}

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
    logger.info(`Created task.md from ${resolvedFile}`)
    return
  }

  // Create task.md from issue body if it doesn't exist
  if (!fs.existsSync(taskMdPath)) {
    if (input.issueNumber) {
      const { getIssue } = await import('./github-api')
      logger.info('task.md not found, fetching issue body to create it...')
      const { body: issueBody, title: issueTitle } = getIssue(input.issueNumber)
      if (issueBody) {
        const titleSection = issueTitle ? `## Issue Title\n\n${issueTitle}\n` : ''
        fs.writeFileSync(taskMdPath, `# Task\n\n${titleSection}${issueBody}\n`)
        logger.info(`Created task.md from issue #${input.issueNumber}`)
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
  --complexity <1-100>   Override complexity score (for testing)
  --is-pull-request      Comment was on a PR (not issue)
  --fresh                Force create new PR (new branch)

Examples:
  pnpm tsx scripts/cody/entry.ts --task-id 260225-my-task --mode full
  pnpm tsx scripts/cody/entry.ts --file docs/feature.md
  pnpm tsx scripts/cody/entry.ts --mode rerun --from verify --feedback "Tests failed"
`)
    return
  }

  // Parse CLI args
  const input = parseCliArgs(args)

  // Create a child logger with task context
  const _stageLogger = createStageLogger('main', input.taskId)

  // R9: Shutdown guard to prevent double-execution on SIGTERM/SIGINT
  let shuttingDown = false
  // G2: Signal handlers with null guard
  const cleanupOnSignal = async (signal: string) => {
    // Prevent double execution (immediate exit on re-entry during async cleanup)
    if (shuttingDown) {
      process.exit(128 + (signal === 'SIGTERM' ? 15 : 2))
      return // unreachable but satisfies TS
    }
    shuttingDown = true
    logger.error(`\n⚠ Received ${signal} — CI runner shutting down`)
    try {
      const { loadState, writeState, updateStage, completeState } = await import('./engine/status')
      const state = loadState(input.taskId)
      if (state) {
        // Mark all running stages as failed
        let updatedState = state
        for (const [name, stage] of Object.entries(state.stages)) {
          if (stage.state === 'running') {
            updatedState = updateStage(updatedState, name, {
              state: 'failed',
              error: `Process interrupted by ${signal}`,
            })
            logger.error(`  Marked stage "${name}" as failed`)
          }
        }
        // Mark pipeline as failed
        const failedState = completeState(updatedState, 'failed')
        writeState(input.taskId, failedState)
        logger.error(`  Updated status.json to "failed" for task ${input.taskId}`)

        // In CI mode: attempt to commit and push the updated status
        if (process.env.GITHUB_ACTIONS === 'true' && !input.local) {
          logger.error(`  Attempting to commit status.json in CI...`)
          try {
            const { execFileSync } = await import('child_process')
            const SIGNAL_TIMEOUT = ms('10s') // 10s max per git op during shutdown
            // Get the directory where status.json is
            const statusPath = `./.tasks/${input.taskId}/status.json`
            execFileSync('git', ['add', statusPath], {
              stdio: 'inherit',
              timeout: SIGNAL_TIMEOUT,
            })
            execFileSync(
              'git',
              [
                'commit',
                '--no-gpg-sign',
                '-m',
                `ci(cody): save interrupted state for ${input.taskId}`,
              ],
              { stdio: 'inherit', timeout: SIGNAL_TIMEOUT },
            )
            execFileSync('git', ['push'], {
              stdio: 'inherit',
              timeout: SIGNAL_TIMEOUT,
            })
            logger.error(`  ✅ Committed and pushed status.json`)
          } catch (commitErr) {
            logger.error({ err: commitErr }, `  ⚠️ Failed to commit/push status.json`)
          }
        }
      }
    } catch (err) {
      logger.error({ err }, `  Failed to update status`)
    }
    // Kill OpenCode server before exiting (sync-safe: just send SIGTERM).
    // We cannot await stopServer() or checkpointDb() here — the signal context
    // limits async work. The WAL checkpoint is skipped on forced shutdown;
    // SQLite will recover the WAL automatically on the next open.
    if (openCodeServer?.process && !openCodeServer.process.killed) {
      openCodeServer.process.kill('SIGTERM')
      openCodeServer = null
    }

    process.exit(128 + (signal === 'SIGTERM' ? 15 : 2))
  }

  process.on('SIGTERM', () => cleanupOnSignal('SIGTERM'))
  process.on('SIGINT', () => cleanupOnSignal('SIGINT'))

  logger.info(`Task: ${input.taskId}`)
  logger.info(`Mode: ${input.mode}`)
  logger.info(`Dry run: ${input.dryRun}`)
  logger.info(`Local: ${input.local}`)
  if (input.issueNumber) logger.info(`Issue: #${input.issueNumber}`)
  logger.info('')

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
    actor: input.actor,
  }

  // Start OpenCode server for persistent sessions across stages
  // Graceful degradation: if startup fails, pipeline runs without server (cold-boot each stage)
  if (input.mode !== 'status') {
    const server = await startServer(taskDir)
    if (server) {
      openCodeServer = server
      ctx.serverUrl = server.url
      logger.info(`  OpenCode server available at ${server.url}`)

      // On rerun: recover lastSessionId from previous pipeline state
      if (input.mode === 'rerun') {
        const { loadState } = await import('./engine/status')
        const existingState = loadState(input.taskId)
        if (existingState) {
          const pipelineOrder = flattenPipelineOrder(
            resolvePipelineForMode('full', ctx.profile, false, ctx).order,
          )
          const lastSid = findLastSessionId(existingState.stages, pipelineOrder)
          if (lastSid) {
            ctx.lastSessionId = lastSid
            logger.info(`  Recovered session ${lastSid} from previous run`)
          }
        }
      }
    }
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
      case 'fix':
        await runFixMode(ctx)
        break
      case 'status':
        await runStatusMode(ctx)
        break
      default:
        throw new Error(`Unknown mode: ${input.mode}`)
    }
  } catch (error) {
    if (error instanceof PipelinePausedError) {
      // Pipeline paused — still need to shut down server and checkpoint DB
      await shutdownOpenCodeServer(taskDir)
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

    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error({ err: error }, `\n❌ Cody failed: ${errorMsg}`)

    // Shutdown OpenCode server before committing (ensures DB is checkpointed)
    await shutdownOpenCodeServer(taskDir)

    // Commit task files on failure — includes debug artifacts (*-events.jsonl, *-stderr.log)
    // for post-mortem diagnosis. On success these are excluded to keep PRs clean.
    try {
      commitPipelineFiles({
        taskDir,
        taskId: input.taskId,
        message: `ci(cody): save failed pipeline state for ${input.taskId}`,
        ensureBranch: true,
        stagingStrategy: 'task-only',
        push: !input.local,
        isCI: !input.local,
        dryRun: input.dryRun,
        pipelineFailed: true,
      })
    } catch (commitErr) {
      logger.warn({ err: commitErr }, 'Failed to commit task files on pipeline failure')
    }

    // Skip GitHub API calls in local mode
    if (input.issueNumber && !input.local) {
      // Set lifecycle label to failed for dashboard visibility
      const { setLifecycleLabel } = await import('./github-api')
      setLifecycleLabel(input.issueNumber, 'cody:failed')
      postComment(
        input.issueNumber,
        `❌ Pipeline failed for \`${input.taskId}\`: ${error instanceof Error ? error.message : 'Unknown error'}` +
          (input.runUrl ? `\nRun: ${input.runUrl}` : ''),
      )
    }
    process.exit(1)
  }

  // Success path: shutdown OpenCode server and checkpoint DB
  await shutdownOpenCodeServer(taskDir)

  // Explicitly exit on success.  Without this the process may hang if
  // the OpenCode server left orphan listeners, timers, or file handles
  // that keep the Node event loop alive.
  process.exit(0)
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
      logger.info('\n⚠️ Clarify stage has questions that need answering')
      const questionsPath = path.join(taskDir, 'questions.md')
      if (input.issueNumber) {
        let preview = '(questions file not found)'
        try {
          if (fs.existsSync(questionsPath)) {
            const questionsContent = fs.readFileSync(questionsPath, 'utf-8')
            preview = questionsContent.slice(0, 1500)
          }
        } catch (readErr) {
          logger.warn({ err: readErr }, 'Failed to read questions.md for preview')
        }
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

  logger.info('\n✅ Cody SPEC pipeline complete')
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
    logger.error(`\n❌ Failed to read task definition: ${msg}`)
    throw new Error(`Invalid task.json: ${msg}`)
  }
  if (!taskDef) {
    throw new Error(`task.json not found. Run spec pipeline first.`)
  }

  // Apply --complexity override if provided
  if (ctx.input.complexityOverride !== undefined && taskDef.complexity === undefined) {
    taskDef.complexity = ctx.input.complexityOverride
    taskDef.complexity_reasoning = `Override via --complexity=${ctx.input.complexityOverride}`
  }

  // Check spec_only pipeline
  if (taskDef.pipeline === 'spec_only') {
    logger.info('Task pipeline is spec_only — skipping implementation stages.')
    return
  }

  // Resolve profile
  const { resolvePipelineProfile } = await import('./pipeline-utils')
  ctx.profile = resolvePipelineProfile(taskDef)
  logger.info(`ℹ️ Pipeline profile: ${ctx.profile}`)

  // Run impl pipeline (pass rebuild callback for two-phase construction)
  const pipeline = resolvePipelineForMode('impl', ctx.profile, false, ctx)
  const rebuild = createRebuildCallback('full', ctx.input.clarify ?? false)
  await runPipeline(ctx, pipeline, undefined, rebuild)

  logger.info('\n✅ Cody IMPLEMENTATION pipeline complete')
}

/**
 * Full mode setup
 */
async function runFullMode(ctx: PipelineContext): Promise<void> {
  logger.info('Running FULL Cody pipeline (spec + impl)...\n')

  // FIX: If a previous run left state as failed/completed, delete it so the
  // pipeline starts fresh.  Without this, runPipeline() sees the terminal state
  // in status.json and returns immediately without executing any stages.
  const { loadState: loadSt2, deleteState } = await import('./engine/status')
  const prevState = loadSt2(ctx.taskId)
  if (prevState && (prevState.state === 'failed' || prevState.state === 'completed')) {
    logger.info(`  Previous run state: ${prevState.state} — resetting for fresh full-mode run`)
    deleteState(ctx.taskId)
  }

  // R4: Ensure task.md exists before running pipeline
  await ensureTaskMd(ctx)

  // FIX #5: Resolve profile from task.json instead of hardcoding 'standard'
  // This ensures the correct profile (lightweight vs standard) is used
  let profile: 'standard' | 'lightweight' = 'standard'
  try {
    const taskDef = readTask(ctx.taskDir)
    if (taskDef) {
      ctx.taskDef = taskDef
      const { resolvePipelineProfile } = await import('./pipeline-utils')
      profile = resolvePipelineProfile(taskDef)
      logger.info(`ℹ️ Resolved profile from task.json: ${profile}`)
    }
  } catch {
    // If task.json doesn't exist yet, taskify will create it and resolve profile
    logger.info('ℹ️ task.json not found yet, will resolve profile after taskify')
  }
  ctx.profile = profile

  // Run full pipeline - pass rebuild callback for two-phase construction
  // This ensures profile changes after taskify are reflected in later stages
  const pipeline = resolvePipelineForMode('full', profile, ctx.input.clarify ?? false, ctx)
  const rebuild = createRebuildCallback('full', ctx.input.clarify ?? false)
  const finalState = await runPipeline(ctx, pipeline, undefined, rebuild)

  // Handle paused state (gate approval required)
  if (finalState.state === 'paused') {
    throw new PipelinePausedError(`Pipeline paused — awaiting gate approval for ${ctx.taskId}`)
  }

  logger.info('\n✅ Full Cody pipeline complete!')
}

/**
 * Rerun mode setup
 */
async function runRerunMode(ctx: PipelineContext): Promise<void> {
  const { input, taskDir } = ctx
  logger.info('Running Cody RERUN pipeline...\n')

  // G33: Check for paused stage FIRST - if we're resuming from a gate approval,
  // we should continue even if spec.md doesn't exist (it may not have been created yet
  // because the gate paused before resolve-profile post-action ran)
  const pausedStage = !input.fromStage ? getLastPausedStage(input.taskId) : null
  let gateApprovedStage: string | null = null

  // G33: Fallback to full only if spec.md missing AND no paused stage to resume
  const specPath = path.join(taskDir, 'spec.md')
  if (!fs.existsSync(specPath) && !pausedStage) {
    logger.info('No spec.md found — falling back to full pipeline')
    input.mode = 'full'
    await runFullMode(ctx)
    return
  }

  // FIX #5: Check for paused stage first (gate approval scenario)
  // This handles the case where @cody approve was used to resume a paused pipeline
  if (pausedStage) {
    logger.info(`Detected paused stage: ${pausedStage}`)

    // Try to approve the gate directly
    try {
      const taskDef = readTask(taskDir)
      if (taskDef) {
        const { handleGateApproval } = await import('./clarify-workflow')
        const gateResult = handleGateApproval(input, taskDir, pausedStage, taskDef)

        if (gateResult === 'approved') {
          logger.info(`Gate ${pausedStage} approved — resuming pipeline`)
          gateApprovedStage = pausedStage

          // Note: handleGateApproval already wrote gate-{stage}-approved.md and clarified.md
          // No need to overwrite here - that would lose the context about how approval was detected

          // Commit and push the approval files so subsequent runs can find them
          // This includes both gate-{stage}-approved.md and clarified.md
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

          // Mark the paused stage as completed in status (immutable update)
          const { loadState, writeState, resumeFromGate } = await import('./engine/status')
          const state = loadState(input.taskId)
          if (state) {
            const resumedState = resumeFromGate(state, pausedStage)
            writeState(input.taskId, resumedState)
          }

          // After approving a spec-phase gate, continue with the rerun pipeline
          // The rerun pipeline already includes both spec and impl stages
          // No mode switch needed - just continue running
        } else if (gateResult === 'waiting') {
          logger.info(`Gate ${pausedStage} still waiting for approval`)
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Could not handle gate approval')
    }
  }

  // G37: Read task definition for profile resolution (MUST be before fromStage resolution)
  let taskDef = null
  try {
    taskDef = readTask(taskDir)
  } catch {
    logger.warn('Could not read task.json for profile resolution, using default')
  }
  ctx.taskDef = taskDef
  if (taskDef) {
    const { resolvePipelineProfile } = await import('./pipeline-utils')
    ctx.profile = resolvePipelineProfile(taskDef)
  }

  // --turbo flag: hard override to turbo profile
  if (ctx.input.turbo) {
    ctx.profile = 'turbo'
    logger.info('⚡ Turbo mode: forcing turbo profile')
  }

  // Determine fromStage
  // FIX #673: After gate approval, use the NEXT stage (not the approved one)
  // to prevent resetFromStage from overwriting the gate approval
  if (!input.fromStage) {
    if (gateApprovedStage) {
      // Gate was just approved — resolve pipeline order to find the next stage
      const tempPipeline = resolvePipelineForMode('rerun', ctx.profile, false, ctx)
      const tempOrder = flattenPipelineOrder(tempPipeline.order)
      input.fromStage = resolveFromStageAfterGateApproval(gateApprovedStage, tempOrder)
      logger.info(`  ℹ️ Gate approved at ${gateApprovedStage} — resuming from ${input.fromStage}`)
    } else {
      input.fromStage = pausedStage || getLastFailedStage(input.taskId) || 'build'
    }
  }

  // Default feedback
  if (!input.feedback) {
    input.feedback = 'Rerun requested via /cody rerun'
  }

  // G37: Write feedback file
  const feedbackFile = path.join(taskDir, 'rerun-feedback.md')
  try {
    fs.writeFileSync(
      feedbackFile,
      `# Rerun Feedback - ${new Date().toISOString()}\n\n## Issues Found\n\n${input.feedback}\n`,
    )
  } catch (writeErr) {
    logger.error({ err: writeErr }, `Failed to write rerun feedback file: ${feedbackFile}`)
    throw writeErr
  }

  logger.info(`Feedback: ${input.feedback}`)
  logger.info(`From stage: ${input.fromStage}\n`)

  // H2 fix: resolve pipeline BEFORE resolveRerunFromStage so we use profile-aware
  // impl stage order. Previously hardcoded IMPL_ORDER_STANDARD which caused turbo
  // rerun with feedback to back up to 'architect' (doesn't exist in turbo).
  const pipeline = resolvePipelineForMode('rerun', ctx.profile, false, ctx)
  const stageOrder = flattenPipelineOrder(pipeline.order)

  // P3 fix: Back up to architect when feedback provided so plan can be revised
  const resolvedFrom = resolveRerunFromStage(input.fromStage || 'build', input.feedback, stageOrder)
  if (resolvedFrom !== input.fromStage) {
    logger.info(
      `  \u2139\ufe0f Feedback provided \u2014 backing up from ${input.fromStage} to ${resolvedFrom} for plan revision`,
    )
    input.fromStage = resolvedFrom
  }

  // Fix 5: Validate fromStage exists in the resolved pipeline order
  let fromStage = input.fromStage || 'build'
  if (!stageOrder.includes(fromStage)) {
    const fallback = findNearestEarlierStage(fromStage, stageOrder)
    logger.warn(
      `Stage "${fromStage}" not in pipeline (valid: ${stageOrder.join(', ')}). Falling back to "${fallback}".`,
    )
    fromStage = fallback
  }

  const { loadState, resetFromStage, writeState } = await import('./engine/status')
  const state = loadState(input.taskId)
  if (state) {
    // H4 FIX: resetFromStage now handles both state reset AND output file deletion
    // No need to manually delete files here - that was causing double-delete
    const newState = resetFromStage(state, fromStage, stageOrder, taskDir)
    writeState(input.taskId, newState)

    // FIX: Update lifecycle label from failed → building so dashboard shows correct status during rerun
    if (input.issueNumber && !input.local) {
      const { setLifecycleLabel } = await import('./github-api')
      setLifecycleLabel(input.issueNumber, 'cody:building')
    }
  }

  // Run impl pipeline
  await runPipeline(ctx, pipeline)

  logger.info('\n✅ Rerun complete!')
}

/**
 * Fix mode - runs the full pipeline on the original task with previous artifacts as context.
 * This gives the agent proper planning (architect, plan-gap) instead of the short fix-only pipeline.
 */
async function runFixMode(ctx: PipelineContext): Promise<void> {
  const { input } = ctx
  logger.info('Running Cody FIX pipeline (full pipeline with original task context)...\n')

  // ===========================================================================
  // Step 0: Merge default branch to get latest fixes
  // ===========================================================================
  if (input.isPullRequest) {
    try {
      mergeDefaultBranch(process.cwd())
    } catch (error) {
      logger.error({ error }, 'Failed to merge default branch, continuing anyway')
    }
  }

  // ===========================================================================
  // Step 1: Resolve original task ID from PR → issue → original task
  // ===========================================================================
  let originalTaskId = input.taskId
  let linkedIssueNumber: number | null = null

  if (input.isPullRequest && input.issueNumber) {
    const prNumber = input.issueNumber

    // Get linked issue from PR
    linkedIssueNumber = getLinkedIssueFromPR(prNumber)
    if (linkedIssueNumber) {
      logger.info(`Found linked issue #${linkedIssueNumber} from PR #${prNumber}`)

      // Discover original task from the issue
      const discoveredTaskId = discoverTaskIdFromIssue(linkedIssueNumber)
      if (discoveredTaskId && discoveredTaskId !== input.taskId) {
        logger.info(`Switching from fix task ${input.taskId} to original task ${discoveredTaskId}`)
        originalTaskId = discoveredTaskId

        // Update input and context
        input.taskId = originalTaskId
      }
    } else {
      logger.warn(`No linked issue found for PR #${prNumber}, using current task`)
    }
  }

  // Get the original task's directory
  const originalTaskDir = getTaskDir(originalTaskId)
  ctx.taskDir = originalTaskDir

  // ===========================================================================
  // Step 2: Archive previous artifacts to prev-run/
  // ===========================================================================
  const prevRunDir = path.join(originalTaskDir, 'prev-run')
  if (!fs.existsSync(prevRunDir)) {
    fs.mkdirSync(prevRunDir, { recursive: true })
  }

  // Copy existing markdown files to prev-run/
  const mdFiles = [
    'spec.md',
    'plan.md',
    'gap.md',
    'build.md',
    'review.md',
    'context.md',
    'test.md',
    'rerun-feedback.md',
  ]
  for (const mdFile of mdFiles) {
    const srcPath = path.join(originalTaskDir, mdFile)
    const destPath = path.join(prevRunDir, mdFile)
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath)
      logger.info(`Archived ${mdFile} to prev-run/`)
    }
  }

  // Copy task.json and status.json if they exist
  const jsonFiles = ['task.json', 'status.json']
  for (const jsonFile of jsonFiles) {
    const srcPath = path.join(originalTaskDir, jsonFile)
    const destPath = path.join(prevRunDir, jsonFile)
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath)
      logger.info(`Archived ${jsonFile} to prev-run/`)
    }
  }

  // ===========================================================================
  // Step 3: Compose task.md from issue body + fix comment
  // ===========================================================================
  const issueBody = linkedIssueNumber ? getIssueBody(linkedIssueNumber) : null

  // Get the fix comment from input.feedback
  const fixComment = input.feedback || 'Fix requested via @cody fix command'

  // Compose task.md content
  let taskMdContent = `# Fix Request\n\n`
  if (issueBody) {
    taskMdContent += `## Original Request (Issue #${linkedIssueNumber})\n\n${issueBody}\n\n`
  }
  taskMdContent += `## Fix Feedback\n\n${fixComment}\n\n`
  taskMdContent += `---\n\n`
  taskMdContent += `*This is a FIX for an existing implementation. Previous artifacts are archived in prev-run/ for context.*\n`

  // Write task.md
  const taskMdPath = path.join(originalTaskDir, 'task.md')
  fs.writeFileSync(taskMdPath, taskMdContent)
  logger.info(`Composed fresh task.md from issue body and fix comment`)

  // Also write rerun-feedback.md for architect/build to read
  const feedbackPath = path.join(originalTaskDir, 'rerun-feedback.md')
  fs.writeFileSync(feedbackPath, `# Fix Feedback - ${new Date().toISOString()}\n\n${fixComment}\n`)

  // ===========================================================================
  // Step 4: Ensure task directory exists and reset state from taskify
  // ===========================================================================
  ensureTaskDir(originalTaskId)

  // Read task definition for profile resolution
  let taskDef = null
  try {
    taskDef = readTask(originalTaskDir)
  } catch {
    logger.warn('Could not read task.json for profile resolution, using default')
  }
  ctx.taskDef = taskDef
  if (taskDef) {
    const { resolvePipelineProfile } = await import('./pipeline-utils')
    ctx.profile = resolvePipelineProfile(taskDef)
  }

  // --turbo flag: hard override to turbo profile
  if (ctx.input.turbo) {
    ctx.profile = 'turbo'
    logger.info('⚡ Turbo mode: forcing turbo profile')
  }

  // Resolve pipeline - now uses FIX_FULL_ORDER (full impl pipeline with taskify)
  const pipeline = resolvePipelineForMode('fix', ctx.profile, false, ctx)
  const stageOrder = flattenPipelineOrder(pipeline.order)

  // Load existing state or create fresh state
  const {
    loadState: loadSt2,
    writeState: writeSt2,
    updateStage: updStage,
    initState: initSt,
  } = await import('./engine/status')

  let state = loadSt2(originalTaskId)

  // Create fresh state starting from taskify (reset all stages)
  if (!state) {
    state = initSt(ctx, 'fix')
  }

  // Reset all stages from taskify onward for a fresh run
  state = resetFromStage(state, 'taskify', stageOrder, originalTaskDir)

  // Mark taskify as pending to start fresh
  state = updStage(state, 'taskify', { state: 'pending', retries: 0 })

  // Set initial cursor to taskify
  state = { ...state, cursor: 'taskify', state: 'running' }
  writeSt2(originalTaskId, state)

  // ===========================================================================
  // Step 5: Run the full pipeline
  // ===========================================================================
  const finalState = await runPipeline(ctx, pipeline)

  // Handle paused state (gate approval required)
  if (finalState.state === 'paused') {
    throw new PipelinePausedError(`Pipeline paused — awaiting gate approval for ${ctx.taskId}`)
  }

  logger.info('\n✅ Fix complete!')
}

/**
 * Status mode
 */
async function runStatusMode(ctx: PipelineContext): Promise<void> {
  const { input } = ctx
  const { loadState } = await import('./engine/status')

  const state = loadState(input.taskId)

  if (!state) {
    logger.info(`No status found for task: ${input.taskId}`)
    logger.info(`The Cody may not have run yet, or status.json was deleted.`)
    return
  }

  logger.info(`Status for ${input.taskId}:`)
  logger.info(state)

  if (input.issueNumber) {
    const v1Status = stateToV1(state)
    postComment(input.issueNumber, formatStatusComment(input, v1Status))
  }
}

// Run main
main().catch((err) => {
  const fatalErr = err instanceof Error ? err.message : String(err)
  logger.error({ err }, `Fatal error: ${fatalErr}`)
  process.exit(1)
})

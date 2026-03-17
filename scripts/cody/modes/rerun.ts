/**
 * @fileType handler
 * @domain cody | modes
 * @ai-summary Pipeline mode handler — extracted from entry.ts for modularity
 */

import * as fs from 'fs'
import * as path from 'path'

import type { PipelineContext } from '../engine/types'
import type { StageName } from '../stages/registry'
import { runPipeline } from '../engine/state-machine'
import { resolvePipelineForMode } from '../engine/pipeline-resolver'
import { logger } from '../logger'
import { readTask } from '../pipeline-utils'

import { flattenPipelineOrder } from '../pipeline/definitions'
import {
  resolveRerunFromStage,
  resolveFromStageAfterGateApproval,
  findNearestEarlierStage,
} from '../rerun-utils'
import { getLastFailedStage, getLastPausedStage } from '../cody-utils'
import { checkoutTaskBranch } from '../git-utils'
import { runFullMode } from './full'

export async function runRerunMode(ctx: PipelineContext): Promise<void> {
  const { input, taskDir } = ctx
  logger.info('Running Cody RERUN pipeline...\n')

  // G33: Check for paused stage FIRST - if we're resuming from a gate approval,
  // we should continue even if spec.md doesn't exist (it may not have been created yet
  // because the gate paused before resolve-profile post-action ran)
  const pausedStage = !input.fromStage ? getLastPausedStage(input.taskId) : null
  let gateApprovedStage: string | null = null

  // Early branch checkout: In CI, rerun mode starts on dev but task files
  // (spec.md, task.md, task.json) live on the feature branch. Checkout the
  // task's feature branch BEFORE checking for files, otherwise we'll falsely
  // fall back to full mode and fail with "task.md not found".
  if (process.env.GITHUB_ACTIONS && !input.dryRun) {
    const checkedOut = checkoutTaskBranch(input.taskId, taskDir)
    if (!checkedOut) {
      logger.info('No feature branch found for task — falling back to full pipeline')
      input.mode = 'full'
      await runFullMode(ctx)
      return
    }
  }

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

    // Helper to approve a gate — writes approval file, commits, and updates state
    const approveGate = async (
      ctx: PipelineContext,
      stage: string,
      reason: string,
    ): Promise<void> => {
      logger.info(`Gate ${stage} ${reason} — resuming pipeline`)

      // Write gate-{stage}-approved.md with the approval reason
      const approvedPath = path.join(ctx.taskDir, `gate-${stage}-approved.md`)
      fs.writeFileSync(
        approvedPath,
        `# Gate Approved\n\nApproved at ${stage} gate.\nApproved by: ${reason}\nApproved at: ${new Date().toISOString()}\n`,
      )

      // Commit and push the approval files so subsequent runs can find them
      const { commitPipelineFiles } = await import('../git-utils')
      await commitPipelineFiles({
        taskDir: ctx.taskDir,
        taskId: ctx.input.taskId,
        message: `ci(cody): gate ${stage} ${reason} for ${ctx.input.taskId}`,
        ensureBranch: true,
        stagingStrategy: 'task-only',
        push: true,
        isCI: !ctx.input.local,
        dryRun: ctx.input.dryRun,
      })

      // Mark the paused stage as completed in status (immutable update)
      const { loadState, writeState, resumeFromGate } = await import('../engine/status')
      const state = loadState(ctx.input.taskId)
      if (state) {
        const resumedState = resumeFromGate(state, stage)
        writeState(ctx.input.taskId, resumedState)
      }
    }

    // Try to approve the gate directly
    try {
      const taskDef = readTask(taskDir)
      if (taskDef) {
        const { handleGateApproval } = await import('../clarify-workflow')
        const gateResult = handleGateApproval(input, taskDir, pausedStage, taskDef)

        if (gateResult === 'approved') {
          // Explicit approval via @cody approve — use the helper
          await approveGate(ctx, pausedStage, 'approved by user')
          gateApprovedStage = pausedStage

          // After approving a spec-phase gate, continue with the rerun pipeline
          // The rerun pipeline already includes both spec and impl stages
          // No mode switch needed - just continue running
        } else if (gateResult === 'waiting') {
          // Implicit approval: @cody rerun is a clear signal the user wants to proceed
          // No need to separately approve a gate they've already seen
          await approveGate(ctx, pausedStage, 'implicitly approved via @cody rerun')
          gateApprovedStage = pausedStage
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
    const { resolvePipelineProfile } = await import('../pipeline-utils')
    ctx.profile = resolvePipelineProfile(taskDef)
  }

  // --turbo flag: hard override to turbo profile
  if (ctx.input.turbo) {
    ctx.profile = 'turbo'
    logger.info('⚡ Turbo mode: forcing turbo profile')
  }

  // Track if fromStage was explicitly provided (via CLI) vs derived from failed/paused stage
  // If explicitly provided, don't inject default feedback (prevents backup to architect on auto-retries)
  const fromStageExplicitlyProvided = !!input.fromStage

  // Determine fromStage
  // FIX #673: After gate approval, use the NEXT stage (not the approved one)
  // to prevent resetFromStage from overwriting the gate approval
  if (!input.fromStage) {
    if (gateApprovedStage) {
      // Gate was just approved — resolve pipeline order to find the next stage
      const tempPipeline = resolvePipelineForMode('rerun', ctx.profile, false, ctx)
      const tempOrder = flattenPipelineOrder(tempPipeline.order)
      input.fromStage = resolveFromStageAfterGateApproval(gateApprovedStage, tempOrder)
      // R3-FIX #2: Trigger pipeline rebuild after gate approval.
      // The profile or task definition may have changed between the original run
      // and this rerun — rebuilding ensures the correct stages are used.
      ctx.pipelineNeedsRebuild = true
      logger.info(`  ℹ️ Gate approved at ${gateApprovedStage} — resuming from ${input.fromStage}`)
    } else {
      // FIX #827: When pipeline state is 'failed', prefer failed stage over paused stage.
      // A stale 'paused' state (e.g., taskify gate was approved but state wasn't updated)
      // should not override the actual failed stage (e.g., build).
      const { loadState: loadSt3 } = await import('../engine/status')
      const prevState = loadSt3(input.taskId)
      const failedStage = getLastFailedStage(input.taskId)

      if (prevState?.state === 'failed' && failedStage) {
        // Pipeline failed — resume from the failed stage, not from a stale paused stage
        logger.info(
          `  ℹ️ Pipeline state is 'failed' — using failed stage '${failedStage}' over paused stage '${pausedStage}'`,
        )
        input.fromStage = failedStage
      } else {
        // Pipeline is paused or unknown — use paused stage (gate approval scenario)
        input.fromStage = pausedStage || failedStage || 'build'
      }
    }
  }

  // Default feedback - but only if fromStage wasn't explicitly provided
  // This prevents unnecessary backup to architect on auto-retries (pipeline-fixer)
  if (!input.feedback && !fromStageExplicitlyProvided) {
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
  if (!stageOrder.includes(fromStage as StageName)) {
    const fallback = findNearestEarlierStage(fromStage, stageOrder)
    logger.warn(
      `Stage "${fromStage}" not in pipeline (valid: ${stageOrder.join(', ')}). Falling back to "${fallback}".`,
    )
    fromStage = fallback
  }

  const { loadState, resetFromStage, writeState } = await import('../engine/status')
  const state = loadState(input.taskId)
  if (state) {
    // H4 FIX: resetFromStage now handles both state reset AND output file deletion
    // No need to manually delete files here - that was causing double-delete
    const newState = resetFromStage(state, fromStage, stageOrder, taskDir)
    writeState(input.taskId, newState)

    // FIX: Update lifecycle label from failed → building so dashboard shows correct status during rerun
    if (input.issueNumber && !input.local) {
      const { setLifecycleLabel } = await import('../github-api')
      setLifecycleLabel(input.issueNumber, 'cody:building')
    }
  }

  // Run impl pipeline
  await runPipeline(ctx, pipeline)

  logger.info('\n✅ Rerun complete!')
}

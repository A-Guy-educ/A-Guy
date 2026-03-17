/**
 * @fileType engine
 * @domain cody | engine
 * @pattern state-machine
 * @ai-summary Core deterministic pipeline execution engine
 */

import type {
  PipelineDefinition,
  PipelineContext,
  PipelineStateV2,
  LifecycleHooks,
  StageDefinition,
  StageResult,
  PipelineStep,
} from './types'
import type { StageName } from '../stages/registry'
import { logger, ciGroup, ciGroupEnd } from '../logger'
import { MAX_PIPELINE_LOOP_ITERATIONS, RECOVERY_CHECK_INTERVAL } from '../config/constants'
import { PipelinePausedError } from './types'
import {
  loadState,
  writeState,
  initState,
  updateStage,
  completeState,
  recoverStaleStages,
  recoverPipelineState,
} from './status'
import { getHandler } from '../handlers/handler'
import { setLifecycleLabel } from '../github-api'
import { executePostAction } from '../pipeline/post-actions'
import { flattenPipelineOrder } from '../pipeline/definitions'
import { execFileSync } from 'node:child_process'
import { commitPipelineFiles } from '../git-utils'

/**
 * Error subclass that carries the originating stage name for parallel error attribution
 */
class StageError extends Error {
  public readonly stageName: string
  public readonly cause?: Error
  constructor(message: string, stageName: string, cause?: Error) {
    super(message)
    this.name = 'StageError'
    this.stageName = stageName
    this.cause = cause
  }
}

// ============================================================================
// Engine
// ============================================================================

/**
 * Main pipeline execution function
 */
export async function runPipeline(
  ctx: PipelineContext,
  pipeline: PipelineDefinition,
  hooks?: LifecycleHooks,
  rebuildPipeline?: (ctx: PipelineContext) => PipelineDefinition,
): Promise<PipelineStateV2> {
  // Load or init state
  let state = loadState(ctx.taskId)
  if (!state) {
    state = initState(ctx, ctx.input.mode)
    // Set initial lifecycle label based on mode
    if (ctx.input.issueNumber) {
      const initialLabel =
        ctx.input.mode === 'spec' || ctx.input.mode === 'full' ? 'cody:planning' : 'cody:building'
      setLifecycleLabel(ctx.input.issueNumber, initialLabel)
    }

    // Early push: overwrite stale status.json on branch so dashboard sees 'running' immediately.
    // Only when the feature branch already exists (re-runs / gate resumes).
    // First runs create the branch in taskify's post-action commit-task-files with ensureBranch.
    if (!ctx.input.dryRun && !ctx.input.local) {
      try {
        const currentBranch = execFileSync('git', ['branch', '--show-current'], {
          encoding: 'utf-8',
        }).trim()
        const isFeatureBranch = !['dev', 'main', 'master'].includes(currentBranch)
        if (isFeatureBranch) {
          commitPipelineFiles({
            taskDir: ctx.taskDir,
            taskId: ctx.taskId,
            message: `ci(cody): reset status to running for ${ctx.taskId}`,
            stagingStrategy: 'task-only',
            push: true,
            isCI: true,
          })
          logger.info('  ✓ Pushed fresh running status.json to branch')
        }
      } catch (earlyPushErr) {
        // Non-fatal — dashboard will update once the first stage completes
        logger.warn({ err: earlyPushErr }, 'Early status push failed (non-fatal)')
      }
    }
  } else {
    // Recovery: handle stale state from previous interrupted runs
    // Step 1: Reset any stages stuck in "running" to "pending"
    state = recoverStaleStages(state)

    // Step 2: Build advisory stages set from pipeline definitions
    const advisoryStages = new Set<string>()
    for (const [name, def] of pipeline.stages) {
      if (def.advisory) advisoryStages.add(name)
    }

    // Step 3: Auto-complete/fail pipeline if all stages are done
    const flatOrder = flattenPipelineOrder(pipeline.order)
    state = recoverPipelineState(state, flatOrder, advisoryStages)
    writeState(ctx.taskId, state)

    // Step 4: If pipeline was previously failed, check if any stages were reset to pending
    // (which means a rerun is happening). Only update the label if we're actually restarting.
    // R2-FIX #5: Don't blindly set 'building' — verify we have pending work to do first.
    if (state.state === 'failed' && ctx.input.issueNumber) {
      const hasPendingStages = Object.values(state.stages).some(
        (s) => s.state === 'pending' || s.state === 'running',
      )
      if (hasPendingStages) {
        setLifecycleLabel(ctx.input.issueNumber, 'cody:building')
      }
    }

    // Step 5: Handle paused pipeline with no paused stages (gate was approved)
    // This handles the case where resumeFromGate() was called to mark the gate stage
    // as completed, but the pipeline-level state is still "paused"
    if (state.state === 'paused') {
      const anyPausedStage = Object.values(state.stages).some((s) => s.state === 'paused')
      if (!anyPausedStage) {
        // Gate was approved - no stages are actually paused, so resume the pipeline
        state = {
          ...state,
          state: 'running',
          updatedAt: new Date().toISOString(),
        }
        writeState(ctx.taskId, state)
      }
    }

    // If recovery determined pipeline is already done, return immediately
    if (state.state === 'completed' || state.state === 'failed') {
      return state
    }
  }

  // Main execution loop
  let loopCount = 0
  while (true) {
    loopCount++

    // Circuit breaker: prevent infinite loops from stage state management bugs
    if (loopCount > MAX_PIPELINE_LOOP_ITERATIONS) {
      logger.error(
        `Pipeline loop exceeded ${MAX_PIPELINE_LOOP_ITERATIONS} iterations — aborting to prevent infinite loop`,
      )
      state = completeState(state, 'failed')
      writeState(ctx.taskId, state)
      throw new Error(
        `Pipeline loop guard triggered after ${MAX_PIPELINE_LOOP_ITERATIONS} iterations. ` +
          'This is likely a bug in stage state management.',
      )
    }

    // FIX #9: Periodic recovery check
    // This handles mid-run corruption of status.json
    if (loopCount % RECOVERY_CHECK_INTERVAL === 0) {
      const currentState = loadState(ctx.taskId)
      if (currentState) {
        // Check for stale running stages
        const recoveredState = recoverStaleStages(currentState)
        if (recoveredState !== currentState) {
          logger.info('⚠️ Periodic recovery: reset stale running stages')
          state = recoveredState
          writeState(ctx.taskId, state)
        }
      }
    }

    // Check if pipeline needs rebuilding (two-phase construction)
    if (ctx.pipelineNeedsRebuild && rebuildPipeline) {
      pipeline = rebuildPipeline(ctx)
      ctx.pipelineNeedsRebuild = false

      // FIX #1/#4: Validate state stages against rebuilt pipeline.
      // New stages (from impl phase) may not exist in state yet — initialize them.
      // Stale stages (removed during rebuild) are harmless (ignored by resolveNextStep).
      const newOrder = flattenPipelineOrder(pipeline.order)
      for (const stageName of newOrder) {
        if (!state.stages[stageName]) {
          state = updateStage(state, stageName, { state: 'pending', retries: 0 })
        }
      }
      writeState(ctx.taskId, state)

      // Transition from planning to building after spec stages complete
      if (ctx.input.issueNumber) {
        setLifecycleLabel(ctx.input.issueNumber, 'cody:building')
      }
    }

    const nextStep = resolveNextStep(state, pipeline)
    if (!nextStep) {
      // All stages completed - mark pipeline as completed
      state = completeState(state, 'completed')
      writeState(ctx.taskId, state)
      // Set lifecycle label to done
      if (ctx.input.issueNumber) {
        setLifecycleLabel(ctx.input.issueNumber, 'cody:done')
      }
      break
    }

    const prevState: PipelineStateV2 | null = state

    // Handle parallel vs sequential
    const step = nextStep as StageName | { parallel: StageName[] }
    if (step && typeof step === 'object' && 'parallel' in step) {
      state = await executeParallelStep(ctx, pipeline, state, step.parallel)
    } else if (step && typeof step === 'string') {
      state = await executeSingleStep(ctx, pipeline, state, step)
    }

    // Persist state
    writeState(ctx.taskId, state)

    // Call lifecycle hook
    if (hooks?.onStateChange && state !== prevState) {
      hooks.onStateChange(prevState, state, ctx)
    }

    // Stop if failed or paused
    if (state.state === 'failed' || state.state === 'paused') {
      break
    }
  }

  // Throw if pipeline failed so caller can handle the failure properly
  if (state.state === 'failed') {
    // Find either failed or timeout stage for better error reporting
    const failedStage = Object.entries(state.stages).find(
      ([, s]) => s.state === 'failed' || s.state === 'timeout',
    )
    const stageName = failedStage?.[0] || 'unknown'
    const stageState = failedStage?.[1]
    const stageOutcome = stageState?.state || 'unknown'
    const stageError = stageState?.error ? `: ${stageState.error}` : ''
    throw new Error(`Pipeline failed at stage: ${stageName} (${stageOutcome})${stageError}`)
  }

  return state
}

/**
 * Resolve the next step to execute
 */
function resolveNextStep(
  state: PipelineStateV2,
  pipeline: PipelineDefinition,
): PipelineStep | null {
  for (const step of pipeline.order) {
    if (typeof step === 'string') {
      // Single stage
      const stageState = state.stages[step]
      // Only run pending stages - failed stages should not auto-retry
      // User can use --from to restart from a specific stage
      // Also run stages that were interrupted (running state from previous run)
      if (!stageState || stageState.state === 'pending' || stageState.state === 'running') {
        return step
      }
    } else if ('parallel' in step) {
      // Parallel stages - check if any need to run
      const needsRun = step.parallel.some((s) => {
        const stageState = state.stages[s]
        return !stageState || stageState.state === 'pending' || stageState.state === 'running'
      })
      if (needsRun) {
        return step
      }
    }
  }
  return null
}

/**
 * Execute a single stage
 */
async function executeSingleStep(
  ctx: PipelineContext,
  pipeline: PipelineDefinition,
  state: PipelineStateV2,
  stageName: StageName,
): Promise<PipelineStateV2> {
  const def = pipeline.stages.get(stageName)
  if (!def) {
    const msg = `Stage '${stageName}' not found in pipeline definitions — check pipeline order vs stage definitions`
    logger.error(msg)
    throw new Error(msg)
  }

  // Check skip conditions
  if (def.shouldSkip) {
    const skipResult = def.shouldSkip(ctx)
    if (skipResult.shouldSkip) {
      logger.info(`  ${stageName} skipped — ${skipResult.reason}`)
      return updateStage(state, stageName, {
        state: 'skipped',
        skipped: skipResult.reason,
      })
    }
  }

  // Check if already completed (resume)
  const stageState = state.stages[stageName]
  if (stageState?.state === 'completed') {
    logger.info(`  ${stageName} already completed, skipping`)
    return state
  }

  // Mark as running
  state = updateStage(state, stageName, { state: 'running', startedAt: new Date().toISOString() })
  writeState(ctx.taskId, state)

  // Dry-run: mark completed without running
  if (ctx.input.dryRun) {
    return updateStage(state, stageName, { state: 'completed', retries: 0 })
  }

  // Run preExecute hook if defined (G20)
  if (def.preExecute) {
    try {
      await def.preExecute(ctx)
    } catch (error) {
      logger.error({ err: error }, `  ❌ preExecute failed for ${stageName}:`)
      return updateStage(state, stageName, {
        state: 'failed',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Get handler and execute
  ciGroup(`Stage: ${stageName}`)
  try {
    const handler = getHandler(def.name, def.type)
    const result = await handler.execute(ctx, def)
    ciGroupEnd()
    return await handleStageResult(ctx, pipeline, state, stageName, result, def)
  } catch (error) {
    ciGroupEnd()
    if (error instanceof PipelinePausedError) {
      // Handle paused - mark stage as paused and pipeline as paused
      state = updateStage(state, stageName, { state: 'paused' })
      return completeState(state, 'paused')
    }
    // Handle failure - mark stage as failed
    logger.error({ err: error }, `  ❌ ${stageName} failed:`)
    state = updateStage(state, stageName, {
      state: 'failed',
      error: error instanceof Error ? error.message : String(error),
    })
    // For non-advisory stages, mark pipeline as failed to stop the loop
    if (!def.advisory) {
      // Set lifecycle label to failed
      if (ctx.input.issueNumber) {
        setLifecycleLabel(ctx.input.issueNumber, 'cody:failed')
      }
      return completeState(state, 'failed')
    }
    return state
  }
}

/**
 * Execute parallel stages
 */
async function executeParallelStep(
  ctx: PipelineContext,
  pipeline: PipelineDefinition,
  state: PipelineStateV2,
  stageNames: StageName[],
): Promise<PipelineStateV2> {
  logger.info(`  Running parallel: [${stageNames.join(', ')}]...`)

  // Filter out already completed stages (for resume)
  const stagesToRun = stageNames.filter((stageName) => {
    const stageState = state.stages[stageName]
    if (stageState?.state === 'completed' || stageState?.state === 'skipped') {
      logger.info(`  ${stageName} already completed/skipped, skipping`)
      return false
    }
    return true
  })

  // If all stages already completed, return current state
  if (stagesToRun.length === 0) {
    return state
  }

  // Dry-run: mark all parallel stages as completed without running
  if (ctx.input.dryRun) {
    for (const stageName of stagesToRun) {
      state = updateStage(state, stageName, { state: 'completed', retries: 0 })
    }
    return state
  }

  const results = await Promise.allSettled(
    stagesToRun.map(async (stageName) => {
      const def = pipeline.stages.get(stageName)
      if (!def) {
        throw new StageError(`Stage '${stageName}' not found in pipeline definitions`, stageName)
      }

      // Check skip first
      if (def.shouldSkip) {
        const skipResult = def.shouldSkip(ctx)
        if (skipResult.shouldSkip) {
          return {
            stageName,
            result: {
              outcome: 'skipped' as const,
              reason: skipResult.reason,
              retries: 0,
            },
          }
        }
      }

      // R10: Run preExecute hook if defined
      if (def.preExecute) {
        try {
          await def.preExecute(ctx)
        } catch (preError) {
          // Wrap error with stageName for rejection handler
          throw new StageError(
            preError instanceof Error ? preError.message : String(preError),
            stageName,
            preError instanceof Error ? preError : undefined,
          )
        }
      }

      // Execute - wrap to tag errors with stageName
      try {
        const handler = getHandler(def.name, def.type)
        const result = await handler.execute(ctx, def)
        return { stageName, result }
      } catch (error) {
        // Wrap error with stageName for rejection handler
        throw new StageError(
          error instanceof Error ? error.message : String(error),
          stageName,
          error instanceof Error ? error : undefined,
        )
      }
    }),
  )

  // Process results - distinguish critical vs advisory failures (R7)
  const criticalFailures: { name: string; reason: string }[] = []
  const advisoryFailures: { name: string; reason: string }[] = []
  let pausedStage: string | null = null

  for (const result of results) {
    if (result.status === 'rejected') {
      // G30: Check if this is a PipelinePausedError (direct or wrapped in StageError)
      const rejectedErr = result.reason
      const isPaused =
        rejectedErr instanceof PipelinePausedError ||
        (rejectedErr instanceof StageError && rejectedErr.cause instanceof PipelinePausedError)
      if (isPaused) {
        // Mark the stage as paused and collect — don't return early
        // This allows other parallel stages to complete their post-actions
        const pausedStageName =
          rejectedErr instanceof StageError ? rejectedErr.stageName : 'unknown'
        state = updateStage(state, pausedStageName, { state: 'paused' })
        pausedStage = pausedStageName
        continue
      }

      const reason = (result as PromiseRejectedResult).reason
      const name =
        reason instanceof StageError
          ? reason.stageName
          : (((reason as Record<string, unknown>)?.stageName as string) ?? 'unknown')
      const message = reason instanceof Error ? reason.message : String(reason)
      // R7: Use dynamic advisory lookup from pipeline definition
      const isAdvisory = pipeline.stages.get(name as StageName)?.advisory === true
      if (isAdvisory) {
        // R2: Mark advisory rejected stage as failed in state
        state = updateStage(state, name, { state: 'failed', error: message })
        advisoryFailures.push({ name, reason: message })
      } else {
        // R1: Mark stage as failed in state before throwing
        state = updateStage(state, name, { state: 'failed', error: message })
        criticalFailures.push({ name, reason: message })
      }
      continue
    }

    const { stageName, result: stageResult } = result.value
    if (!stageResult) continue

    // Handle PipelinePausedError specially (G30) — collect pauses instead of returning early
    if (stageResult.outcome === 'paused') {
      state = updateStage(state, stageName, { state: 'paused' })
      pausedStage = stageName
      continue
    }

    // Update state based on outcome
    if (stageResult.outcome === 'completed') {
      state = updateStage(state, stageName, {
        state: 'completed',
        completedAt: new Date().toISOString(),
        retries: stageResult.retries,
        outputFile: stageResult.outputFile,
        sessionId: stageResult.sessionId,
      })

      // FIX #2: Propagate sessionId deterministically — use the stage that comes
      // last in the pipeline order, regardless of which parallel stage completes first.
      // This ensures consistent session forking across runs.
      if (stageResult.sessionId) {
        if (!ctx.lastSessionId) {
          ctx.lastSessionId = stageResult.sessionId
        } else {
          // Overwrite only if this stage comes after the current lastSessionId owner
          // in the pipeline order. Since we process results in order, the last
          // successful stage's sessionId is used.
          ctx.lastSessionId = stageResult.sessionId
        }
      }

      // R8: Run post-actions for completed parallel stages
      const def = pipeline.stages.get(stageName)
      if (def?.postActions && !ctx.input.dryRun) {
        try {
          for (const action of def.postActions) {
            await executePostAction(ctx, action, state)
          }
        } catch (postError) {
          // Handle post-action errors - mirroring executeSingleStep pattern
          // Collect pauses instead of returning early — allows other stages to complete
          if (postError instanceof PipelinePausedError) {
            state = updateStage(state, stageName, { state: 'paused' })
            pausedStage = stageName
            continue
          }
          // FIX #3: Don't immediately fail - collect failures and process at end
          // This allows other successful parallel stages to complete
          logger.error({ err: postError }, `  Post-action failed for parallel stage ${stageName}:`)
          const postErrorMsg = postError instanceof Error ? postError.message : String(postError)
          state = updateStage(state, stageName, {
            state: 'failed',
            error: postErrorMsg,
          })
          const isAdvisory = pipeline.stages.get(stageName)?.advisory === true
          if (isAdvisory) {
            advisoryFailures.push({ name: stageName, reason: postErrorMsg })
          } else {
            criticalFailures.push({ name: stageName, reason: postErrorMsg })
          }
        }
      }
    } else if (stageResult.outcome === 'skipped') {
      state = updateStage(state, stageName, {
        state: 'skipped',
        skipped: stageResult.reason,
      })
    } else if (stageResult.outcome === 'failed') {
      // R7: Use dynamic advisory lookup from pipeline definition
      const isAdvisory = pipeline.stages.get(stageName)?.advisory === true
      if (isAdvisory) {
        // R1: Mark stage as failed in state
        state = updateStage(state, stageName, {
          state: 'failed',
          error: stageResult.reason || 'failed',
        })
        advisoryFailures.push({ name: stageName, reason: stageResult.reason || 'failed' })
      } else {
        // R1: Mark stage as failed in state before returning failed state
        state = updateStage(state, stageName, {
          state: 'failed',
          error: stageResult.reason || 'failed',
        })
        criticalFailures.push({ name: stageName, reason: stageResult.reason || 'failed' })
      }
    }
  }

  // R2: Return failed state instead of throwing (main loop sees failed state and breaks cleanly)
  if (criticalFailures.length > 0) {
    const errors = criticalFailures.map((f) => f.reason).join('; ')
    const names = criticalFailures.map((f) => f.name)
    logger.error(`  ❌ Parallel stages [${names.join(', ')}] failed: ${errors}`)
    // Set lifecycle label to failed
    if (ctx.input.issueNumber) {
      setLifecycleLabel(ctx.input.issueNumber, 'cody:failed')
    }
    return completeState(state, 'failed')
  }

  // Return paused state if any stage paused — after all other stages processed
  if (pausedStage) {
    writeState(ctx.taskId, state)
    return completeState(state, 'paused')
  }

  return state
}

/**
 * Handle stage result and run post-actions
 */
async function handleStageResult(
  ctx: PipelineContext,
  pipeline: PipelineDefinition,
  state: PipelineStateV2,
  stageName: string,
  result: StageResult,
  def: StageDefinition,
): Promise<PipelineStateV2> {
  // Compute elapsed time from startedAt
  const startedAt = state.stages[stageName]?.startedAt
  const elapsed = startedAt
    ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
    : undefined

  if (result.outcome === 'completed') {
    state = updateStage(state, stageName, {
      state: 'completed',
      completedAt: new Date().toISOString(),
      elapsed,
      retries: result.retries,
      outputFile: result.outputFile,
      tokenUsage: result.tokenUsage,
      cost: result.cost,
      sessionId: result.sessionId,
    })

    // Propagate sessionId for downstream stage forking
    if (result.sessionId) {
      ctx.lastSessionId = result.sessionId
    }

    // Run post-actions if defined
    if (def.postActions) {
      for (const action of def.postActions) {
        await executePostAction(ctx, action, state)
        // Note: executePostAction may throw PipelinePausedError
        // which propagates up to executeSingleStep's catch block
      }
    }
  } else if (result.outcome === 'failed') {
    // Generic declarative retry via retryWith
    if (def.retryWith && !def.advisory) {
      const { stage: retryStage, maxAttempts, onFailure } = def.retryWith
      const retryState = state.stages[retryStage]
      const currentAttempt = retryState?.fixAttempt ?? 0

      if (currentAttempt < maxAttempts) {
        if (onFailure) {
          await onFailure(ctx, ctx.taskDir)
        }

        const newAttempt = currentAttempt + 1
        state = updateStage(state, retryStage, {
          state: 'pending',
          fixAttempt: newAttempt,
          maxFixAttempts: maxAttempts,
        })
        state = updateStage(state, stageName, { state: 'pending' })
        writeState(ctx.taskId, state)

        logger.info(
          `🔄 ${stageName} failed, looping to ${retryStage} (attempt ${newAttempt}/${maxAttempts})`,
        )
        return state
      } else {
        logger.error(
          `Max retry attempts (${maxAttempts}) reached for ${retryStage}, pipeline failing`,
        )
        // Fall through to normal failure handling
      }
    }

    // Normal failure handling
    state = updateStage(state, stageName, {
      state: 'failed',
      elapsed,
      error: result.reason,
    })

    // If non-advisory stage failed, mark pipeline as failed
    if (!def.advisory) {
      // Set lifecycle label to failed
      if (ctx.input.issueNumber) {
        setLifecycleLabel(ctx.input.issueNumber, 'cody:failed')
      }
      return completeState(state, 'failed')
    }
  } else if (result.outcome === 'timed_out') {
    state = updateStage(state, stageName, {
      state: 'timeout',
      elapsed,
      error: result.reason,
    })

    // Generic timeout recovery: if any stage declares retryWith pointing to this
    // timed-out stage with onTimeout: 'retry', reset that stage to pending so it
    // can re-evaluate (e.g., verify checks if partial fix work was enough).
    const retryingDef = [...pipeline.stages.values()].find(
      (s) => s.retryWith?.stage === stageName && s.retryWith.onTimeout === 'retry',
    )
    if (retryingDef) {
      logger.info(
        `⚠️ ${stageName} timed out — running ${retryingDef.name} to check if partial work suffices`,
      )
      state = updateStage(state, retryingDef.name, { state: 'pending' })
      writeState(ctx.taskId, state)
      return state // Don't fail pipeline — let the retrying stage check
    }

    if (!def.advisory) {
      // Set lifecycle label to failed
      if (ctx.input.issueNumber) {
        setLifecycleLabel(ctx.input.issueNumber, 'cody:failed')
      }
      return completeState(state, 'failed')
    }
  }

  return state
}

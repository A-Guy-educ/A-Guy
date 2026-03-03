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
import { logger } from '../logger'
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

    // Step 4: Handle paused pipeline with no paused stages (gate was approved)
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

    // FIX #9: Periodic recovery check every 10 iterations
    // This handles mid-run corruption of status.json
    if (loopCount % 10 === 0) {
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
    const step = nextStep as string | { parallel: string[] }
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
    const failedStage = Object.entries(state.stages).find(([, s]) => s.state === 'failed')
    throw new Error(`Pipeline failed at stage: ${failedStage?.[0] || 'unknown'}`)
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
  stageName: string,
): Promise<PipelineStateV2> {
  const def = pipeline.stages.get(stageName)
  if (!def) {
    logger.warn(`Stage ${stageName} not found in pipeline definitions`)
    return state
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
  const handler = getHandler(def.name, def.type)

  try {
    const result = await handler.execute(ctx, def)
    return await handleStageResult(ctx, state, stageName, result, def)
  } catch (error) {
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
  stageNames: string[],
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

  const results = await Promise.allSettled(
    stagesToRun.map(async (stageName) => {
      const def = pipeline.stages.get(stageName)
      if (!def) {
        return { stageName, result: null as unknown as StageResult }
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
          // Tag error with stageName for rejection handler
          if (preError instanceof Error) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(preError as any).stageName = stageName
          }
          throw preError
        }
      }

      // Execute - wrap to tag errors with stageName
      try {
        const handler = getHandler(def.name, def.type)
        const result = await handler.execute(ctx, def)
        return { stageName, result }
      } catch (error) {
        // Tag error with stageName for rejection handler (G30)
        if (error instanceof Error) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(error as any).stageName = stageName
        }
        throw error
      }
    }),
  )

  // Process results - distinguish critical vs advisory failures (R7)
  const criticalFailures: { name: string; reason: string }[] = []
  const advisoryFailures: { name: string; reason: string }[] = []

  for (const result of results) {
    if (result.status === 'rejected') {
      // G30: Check if this is a PipelinePausedError
      if (result.reason instanceof PipelinePausedError) {
        // Mark the stage as paused and return paused state
        const reason = result.reason as Error & { stageName?: string }
        const stageName = reason.stageName || 'unknown'
        state = updateStage(state, stageName, { state: 'paused' })
        return completeState(state, 'paused')
      }

      const reason = (result as PromiseRejectedResult).reason as
        | (Error & { stageName?: string })
        | undefined
      const name = reason?.stageName || 'unknown'
      const message = reason?.message || String(result.reason)
      // R7: Use dynamic advisory lookup from pipeline definition
      const isAdvisory = pipeline.stages.get(name)?.advisory === true
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

    // Handle PipelinePausedError specially (G30)
    if (stageResult.outcome === 'paused') {
      state = updateStage(state, stageName, { state: 'paused' })
      writeState(ctx.taskId, state) // Persist paused state to disk
      // Return early with paused state
      return completeState(state, 'paused')
    }

    // Update state based on outcome
    if (stageResult.outcome === 'completed') {
      state = updateStage(state, stageName, {
        state: 'completed',
        completedAt: new Date().toISOString(),
        retries: stageResult.retries,
        outputFile: stageResult.outputFile,
      })

      // R8: Run post-actions for completed parallel stages
      const def = pipeline.stages.get(stageName)
      if (def?.postActions) {
        try {
          for (const action of def.postActions) {
            await executePostAction(ctx, action, state)
          }
        } catch (postError) {
          // Handle post-action errors - mirroring executeSingleStep pattern
          if (postError instanceof PipelinePausedError) {
            state = updateStage(state, stageName, { state: 'paused' })
            writeState(ctx.taskId, state) // Persist paused state to disk
            return completeState(state, 'paused')
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

  return state
}

/**
 * Handle stage result and run post-actions
 */
async function handleStageResult(
  ctx: PipelineContext,
  state: PipelineStateV2,
  stageName: string,
  result: StageResult,
  def: StageDefinition,
): Promise<PipelineStateV2> {
  if (result.outcome === 'completed') {
    state = updateStage(state, stageName, {
      state: 'completed',
      completedAt: new Date().toISOString(),
      retries: result.retries,
      outputFile: result.outputFile,
    })

    // Run post-actions if defined
    if (def.postActions) {
      for (const action of def.postActions) {
        await executePostAction(ctx, action, state)
        // Note: executePostAction may throw PipelinePausedError
        // which propagates up to executeSingleStep's catch block
      }
    }
  } else if (result.outcome === 'failed') {
    state = updateStage(state, stageName, {
      state: 'failed',
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
      error: result.reason,
    })
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

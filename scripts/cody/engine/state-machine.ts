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
import { PipelinePausedError } from './types'
import { loadState, writeState, initState, updateStage, completeState } from './status'
import { getHandler } from '../handlers/handler'
import { executePostAction } from '../pipeline/post-actions'

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
  }

  // Main execution loop
  while (true) {
    // Check if pipeline needs rebuilding (two-phase construction)
    if (ctx.pipelineNeedsRebuild && rebuildPipeline) {
      pipeline = rebuildPipeline(ctx)
      ctx.pipelineNeedsRebuild = false
    }

    const nextStep = resolveNextStep(state, pipeline)
    if (!nextStep) {
      // All done
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
      if (!stageState || stageState.state === 'pending' || stageState.state === 'failed') {
        return step
      }
    } else if ('parallel' in step) {
      // Parallel stages - check if any need to run
      const needsRun = step.parallel.some((s) => {
        const stageState = state.stages[s]
        return !stageState || stageState.state === 'pending' || stageState.state === 'failed'
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
    console.warn(`Stage ${stageName} not found in pipeline definitions`)
    return state
  }

  // Check skip conditions
  if (def.shouldSkip) {
    const skipResult = def.shouldSkip(ctx)
    if (skipResult.shouldSkip) {
      console.log(`  ${stageName} skipped — ${skipResult.reason}`)
      return updateStage(state, stageName, {
        state: 'skipped',
        skipped: skipResult.reason,
      })
    }
  }

  // Check if already completed (resume)
  const stageState = state.stages[stageName]
  if (stageState?.state === 'completed') {
    console.log(`  ${stageName} already completed, skipping`)
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
      console.error(`  ❌ preExecute failed for ${stageName}:`, error)
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
    // Handle failure
    console.error(`  ❌ ${stageName} failed:`, error)
    return updateStage(state, stageName, {
      state: 'failed',
      error: error instanceof Error ? error.message : String(error),
    })
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
  console.log(`  Running parallel: [${stageNames.join(', ')}]...`)

  const results = await Promise.allSettled(
    stageNames.map(async (stageName) => {
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

  // Process results - distinguish critical vs advisory failures
  const ADVISORY_STAGES = new Set(['auditor'])
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
      if (ADVISORY_STAGES.has(name)) {
        advisoryFailures.push({ name, reason: message })
      } else {
        criticalFailures.push({ name, reason: message })
      }
      continue
    }

    const { stageName, result: stageResult } = result.value
    if (!stageResult) continue

    // Handle PipelinePausedError specially (G30)
    if (stageResult.outcome === 'paused') {
      state = updateStage(state, stageName, { state: 'paused' })
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
    } else if (stageResult.outcome === 'skipped') {
      state = updateStage(state, stageName, {
        state: 'skipped',
        skipped: stageResult.reason,
      })
    } else if (stageResult.outcome === 'failed') {
      if (ADVISORY_STAGES.has(stageName)) {
        advisoryFailures.push({ name: stageName, reason: stageResult.reason || 'failed' })
      } else {
        criticalFailures.push({ name: stageName, reason: stageResult.reason || 'failed' })
      }
    }
  }

  // Only throw if critical failures
  if (criticalFailures.length > 0) {
    const errors = criticalFailures.map((f) => f.reason).join('; ')
    const names = criticalFailures.map((f) => f.name)
    throw new Error(`Parallel stages [${names.join(', ')}] failed: ${errors}`)
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
      return completeState(state, 'failed')
    }
  } else if (result.outcome === 'timed_out') {
    state = updateStage(state, stageName, {
      state: 'timeout',
      error: result.reason,
    })
    if (!def.advisory) {
      return completeState(state, 'failed')
    }
  }

  return state
}

/**
 * @fileType handler
 * @domain cody | modes
 * @ai-summary Pipeline mode handler — extracted from entry.ts for modularity
 */

import type { PipelineContext } from '../engine/types'
import { PipelinePausedError } from '../engine/types'
import { runPipeline } from '../engine/state-machine'
import { resolvePipelineForMode, createRebuildCallback } from '../engine/pipeline-resolver'
import { logger } from '../logger'
import { readTask } from '../pipeline-utils'

import { ensureTaskMd } from '../task-setup'

export async function runFullMode(ctx: PipelineContext): Promise<void> {
  logger.info('Running FULL Cody pipeline (spec + impl)...\n')

  // FIX: If a previous run left state as failed/completed, delete it so the
  // pipeline starts fresh.  Without this, runPipeline() sees the terminal state
  // in status.json and returns immediately without executing any stages.
  const { loadState: loadSt2, deleteState } = await import('../engine/status')
  const prevState = loadSt2(ctx.taskId)
  if (prevState && (prevState.state === 'failed' || prevState.state === 'completed')) {
    logger.info(`  Previous run state: ${prevState.state} — resetting for fresh full-mode run`)
    deleteState(ctx.taskId)
  }

  // R4: Ensure task.md exists before running pipeline
  await ensureTaskMd(ctx)

  // FIX #5: Resolve profile from task.json instead of hardcoding 'standard'
  // This ensures the correct profile (lightweight vs standard) is used
  let profile: 'standard' | 'lightweight' | 'turbo' = 'standard'
  try {
    const taskDef = readTask(ctx.taskDir)
    if (taskDef) {
      ctx.taskDef = taskDef
      const { resolvePipelineProfile } = await import('../pipeline-utils')
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

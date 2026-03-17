/**
 * @fileType handler
 * @domain cody | modes
 * @ai-summary Pipeline mode handler — extracted from entry.ts for modularity
 */

import * as fs from 'fs'
import * as path from 'path'

import type { PipelineContext } from '../engine/types'
import { runPipeline } from '../engine/state-machine'
import { resolvePipelineForMode, createRebuildCallback } from '../engine/pipeline-resolver'
import { logger } from '../logger'
import { readTask } from '../pipeline-utils'

export async function runImplMode(ctx: PipelineContext): Promise<void> {
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
  const { resolvePipelineProfile } = await import('../pipeline-utils')
  ctx.profile = resolvePipelineProfile(taskDef)
  logger.info(`ℹ️ Pipeline profile: ${ctx.profile}`)

  // Run impl pipeline (pass rebuild callback for two-phase construction)
  const pipeline = resolvePipelineForMode('impl', ctx.profile, false, ctx)
  const rebuild = createRebuildCallback('full', ctx.input.clarify ?? false)
  await runPipeline(ctx, pipeline, undefined, rebuild)

  logger.info('\n✅ Cody IMPLEMENTATION pipeline complete')
}

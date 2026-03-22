/**
 * @fileType handler
 * @domain cody | modes | brain
 * @ai-summary Brain-aware full mode — uses remote brain for architect + review when available
 */

import * as fs from 'fs'
import * as path from 'path'

import type { PipelineContext } from '../engine/types'
import { PipelinePausedError } from '../engine/types'
import { runPipeline } from '../engine/state-machine'
import { resolvePipelineForMode } from '../engine/pipeline-resolver'
import { logger } from '../logger'
import { ensureTaskMd } from '../task-setup'
import { isBrainAvailable } from '../brain-health'
import { runArchitectBrain } from '../architect-brain'
import { runReviewBrain } from '../review-brain'
import { parseTaskDefinition } from '../pipeline/task-schema'

/**
 * Brain-aware full mode handler.
 *
 * When BRAIN_SERVER_URL is set and brain is reachable:
 *   1. Run remote architect (replaces taskify + gap + architect)
 *   2. Write task.json + plan.md to taskDir
 *   3. Run local impl pipeline (build + verify)
 *   4. Run remote review
 *   5. Write review.md to taskDir
 *   6. Proceed to commit + PR
 *
 * When brain is unavailable:
 *   Falls back to standard full pipeline.
 */
export async function runBrainFullMode(ctx: PipelineContext): Promise<void> {
  const BRAIN_SERVER_URL = process.env.BRAIN_SERVER_URL

  // Check brain availability
  const brainAvailable = await isBrainAvailable(BRAIN_SERVER_URL)

  if (!brainAvailable || !BRAIN_SERVER_URL) {
    logger.info('🧠 Brain server unavailable — falling back to standard pipeline')
    // Import and call standard full mode
    const { runFullMode } = await import('./full')
    return runFullMode(ctx)
  }

  logger.info('🧠 Brain server available — using remote architect + review')

  // R4: Ensure task.md exists before running pipeline
  await ensureTaskMd(ctx)

  // Read task.md for architect input
  const taskMdPath = path.join(ctx.taskDir, 'task.md')
  const taskMd = fs.readFileSync(taskMdPath, 'utf-8')

  // Phase 1: Remote architect (replaces taskify + gap + architect)
  logger.info('  🧠 Running remote architect...')
  let taskJson: object = {}
  let planMd = ''

  try {
    const result = await runArchitectBrain(taskMd, BRAIN_SERVER_URL)
    taskJson = result.taskJson
    planMd = result.planMd
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error({ err: error }, `  🧠 Architect brain failed: ${errorMsg}`)
    logger.info('  Falling back to standard pipeline...')
    const { runFullMode } = await import('./full')
    return runFullMode(ctx)
  }

  // Validate and write task.json
  try {
    const validatedTask = parseTaskDefinition(taskJson)
    const taskJsonPath = path.join(ctx.taskDir, 'task.json')
    fs.writeFileSync(taskJsonPath, JSON.stringify(validatedTask, null, 2) + '\n')
    ctx.taskDef = validatedTask
    logger.info('  ✅ task.json written')
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.warn({ err: error }, `  ⚠️ task.json validation failed, using raw output: ${errorMsg}`)
    // Write raw JSON as fallback
    const taskJsonPath = path.join(ctx.taskDir, 'task.json')
    fs.writeFileSync(taskJsonPath, JSON.stringify(taskJson, null, 2) + '\n')
  }

  // Write plan.md
  const planMdPath = path.join(ctx.taskDir, 'plan.md')
  fs.writeFileSync(planMdPath, planMd)
  logger.info('  ✅ plan.md written')

  // Resolve profile from task.json
  let profile: 'standard' | 'lightweight' | 'turbo' = 'standard'
  if (ctx.taskDef?.pipeline_profile) {
    profile = ctx.taskDef.pipeline_profile
  }
  ctx.profile = profile
  logger.info(`ℹ️ Profile: ${profile}`)

  // Phase 2: Local impl pipeline (build + verify)
  // Uses 'impl' mode to skip spec stages (already done by brain)
  const pipeline = resolvePipelineForMode('impl', profile, false, ctx)
  logger.info('  🔨 Running local impl pipeline (build + verify)...')
  const finalState = await runPipeline(ctx, pipeline)

  // Handle paused state (gate approval required)
  if (finalState.state === 'paused') {
    throw new PipelinePausedError(`Pipeline paused — awaiting gate approval for ${ctx.taskId}`)
  }

  // Phase 3: Remote review
  logger.info('  🧠 Running remote review...')
  const changedFiles = getChangedFiles(ctx.taskDir)
  const diffs = getDiffs()

  try {
    const reviewMd = await runReviewBrain(planMd, changedFiles, diffs, BRAIN_SERVER_URL)
    const reviewMdPath = path.join(ctx.taskDir, 'review.md')
    fs.writeFileSync(reviewMdPath, reviewMd)
    logger.info('  ✅ review.md written')
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.warn({ err: error }, `  ⚠️ Review brain failed: ${errorMsg}`)
    // Write placeholder review
    const reviewMdPath = path.join(ctx.taskDir, 'review.md')
    fs.writeFileSync(
      reviewMdPath,
      `# Review\n\nBrain review unavailable: ${errorMsg}\n\nRun standard pipeline to get a proper review.`,
    )
  }

  logger.info('\n✅ Brain-aware full Cody pipeline complete!')
}

/**
 * Get list of changed files from git.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
function getChangedFiles(_taskDir: string): string[] {
  try {
    const { execFileSync } = require('child_process')
    const diff = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf-8' }).trim()
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      encoding: 'utf-8',
    }).trim()
    const allChanged = [...diff.split('\n'), ...untracked.split('\n')]
      .filter(Boolean)
      .filter((f: string) => !f.startsWith('.tasks/') && !f.startsWith('node_modules/'))
    return allChanged
  } catch {
    return []
  }
}

/**
 * Get git diff for changed files.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
function getDiffs(): string {
  try {
    const { execFileSync } = require('child_process')
    const diff = execFileSync('git', ['diff'], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
    return diff
  } catch {
    return ''
  }
}

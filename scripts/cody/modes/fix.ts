/**
 * @fileType handler
 * @domain cody | modes
 * @ai-summary Pipeline mode handler — extracted from entry.ts for modularity
 */

import * as fs from 'fs'
import * as path from 'path'

import type { PipelineContext } from '../engine/types'
import { PipelinePausedError } from '../engine/types'
import { runPipeline } from '../engine/state-machine'
import { resolvePipelineForMode } from '../engine/pipeline-resolver'
import { logger } from '../logger'
import { readTask } from '../pipeline-utils'
import { mergeDefaultBranch } from '../git-utils'

import { getIssueBody, getLinkedIssueFromPR, discoverTaskIdFromIssue } from '../github-api'
import { getTaskDir, ensureTaskDir } from '../cody-utils'
import { flattenPipelineOrder } from '../pipeline/definitions'
import { resetFromStage } from '../engine/status'

export async function runFixMode(ctx: PipelineContext): Promise<void> {
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
    const { resolvePipelineProfile } = await import('../pipeline-utils')
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
  } = await import('../engine/status')

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
  state = {
    ...state,
    cursor: 'taskify',
    state: 'running',
  }
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

/**
 * @fileType plugin
 * @domain inspector
 * @pattern deferred-stages-plugin
 * @ai-summary Runs docs for tasks (complexity ≥ 30) that completed PR but missed that stage
 *
 * Docs was removed from the live pipeline to save 2-5 min and 1 LLM call per run.
 * This inspector plugin picks up completed tasks and triggers the docs stage via
 * `cody.yml` workflow dispatch with `mode=rerun from_stage=docs`.
 *
 * Complexity gate: only tasks with complexity ≥ 30 are eligible (matching the review threshold).
 * Low-complexity tasks (< 30) skip docs entirely.
 *
 * Note: reflect stage has been removed from the pipeline. Knowledge Gardener (nightly inspector)
 * subsumes reflect functionality.
 */

import * as fs from 'fs'
import * as path from 'path'

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'

const STATE_KEY = 'cody:deferredStagesProcessed'

interface StageEntry {
  state?: string
}

interface TaskStatus {
  state?: string
  version?: number
  stages?: Record<string, StageEntry>
}

interface TaskJson {
  complexity?: number
}

/**
 * Read complexity from task.json. Returns 0 if not found or invalid.
 */
function getTaskComplexity(taskDir: string): number {
  const taskJsonPath = path.join(taskDir, 'task.json')
  try {
    if (fs.existsSync(taskJsonPath)) {
      const data = JSON.parse(fs.readFileSync(taskJsonPath, 'utf-8')) as TaskJson
      if (typeof data.complexity === 'number') {
        return data.complexity
      }
    }
  } catch {
    // Ignore errors, return 0 (below threshold)
  }
  return 0
}

/** Minimum complexity for docs to run via nightly inspector */
export const DOCS_COMPLEXITY_THRESHOLD = 30

/**
 * Check if a task has completed PR but is missing docs output,
 * and meets the complexity threshold.
 *
 * A task is eligible if:
 *   1. The `pr` stage is completed (pipeline finished)
 *   2. The `docs` stage is not completed
 *   3. docs.md output file does not already exist
 *   4. Task complexity is ≥ DOCS_COMPLEXITY_THRESHOLD (30)
 */
function isEligibleForDeferredDocs(
  taskDir: string,
  status: TaskStatus,
  complexity: number,
): boolean {
  // Must meet complexity threshold
  if (complexity < DOCS_COMPLEXITY_THRESHOLD) {
    return false
  }

  const stages = status.stages || {}

  // Must have completed pr stage
  const prStage = stages['pr']
  if (!prStage || prStage.state !== 'completed') {
    return false
  }

  // Check if docs is already completed
  const docsStage = stages['docs']
  if (docsStage?.state === 'completed') {
    return false
  }

  // Check if docs.md output file already exists (docs ran outside status tracking)
  const docsMdPath = path.join(taskDir, 'docs.md')
  if (fs.existsSync(docsMdPath)) {
    return false
  }

  return true
}

/**
 * Trigger cody.yml workflow to run docs for a task.
 */
function createDeferredDocsAction(taskId: string, _ctx: InspectorContext): ActionRequest {
  return {
    plugin: 'cody-deferred-stages',
    type: 'trigger-deferred-stages',
    target: taskId,
    urgency: 'info',
    title: `Run deferred docs for ${taskId}`,
    detail: `Task ${taskId} completed PR but is missing docs. Triggering deferred docs stage.`,
    // Dedup: don't retrigger the same task within 6 hours
    dedupKey: `deferred-stages:${taskId}`,
    dedupWindowMinutes: 360,
    async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
      if (execCtx.dryRun) {
        execCtx.log.info({ taskId }, '[dry-run] Would trigger cody.yml for deferred docs stage')
        return { success: true, message: 'dry-run: skipped' }
      }

      try {
        execCtx.github.triggerWorkflow('cody.yml', {
          task_id: taskId,
          mode: 'rerun',
          from_stage: 'docs',
        })
        execCtx.log.info({ taskId }, 'Triggered cody.yml for deferred docs stage')
        return { success: true, message: `Triggered deferred docs for ${taskId}` }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        execCtx.log.error({ taskId, error: msg }, 'Failed to trigger deferred docs stage')
        return { success: false, message: msg }
      }
    },
  }
}

/**
 * Deferred Stages plugin - runs docs for tasks (complexity ≥ 30) that completed the pipeline.
 *
 * Runs every 6th cycle (~30 min) to batch up multiple completed tasks.
 */
export const deferredStagesPlugin: InspectorPlugin = {
  name: 'cody-deferred-stages',
  description: 'Trigger docs for tasks (complexity ≥ 30) that completed PR but missed that stage',
  domain: 'cody',
  schedule: { every: 6 }, // Every 6th cycle = every ~30 min

  async run(ctx) {
    ctx.log.debug('Running deferred-stages plugin')

    const processedTasks = ctx.state.get<string[]>(STATE_KEY) || []
    ctx.log.debug({ processedCount: processedTasks.length }, 'Previously processed tasks')

    const tasksDir = path.join(process.cwd(), '.tasks')
    if (!fs.existsSync(tasksDir)) {
      return []
    }

    const entries = fs.readdirSync(tasksDir, { withFileTypes: true })
    const actions: ActionRequest[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const taskId = entry.name

      // Skip already processed
      if (processedTasks.includes(taskId)) {
        ctx.log.debug({ taskId }, 'Skipping already-processed task')
        continue
      }

      const taskDir = path.join(tasksDir, taskId)
      const statusPath = path.join(taskDir, 'status.json')

      if (!fs.existsSync(statusPath)) continue

      let status: TaskStatus
      try {
        status = JSON.parse(fs.readFileSync(statusPath, 'utf-8')) as TaskStatus
      } catch {
        continue
      }

      const complexity = getTaskComplexity(taskDir)

      if (!isEligibleForDeferredDocs(taskDir, status, complexity)) {
        // If PR is completed, mark as processed so we don't keep checking
        const stages = status.stages || {}
        const prStage = stages['pr']
        if (prStage?.state === 'completed') {
          processedTasks.push(taskId)
        }
        continue
      }

      ctx.log.info({ taskId, complexity }, 'Task eligible for deferred docs stage')
      actions.push(createDeferredDocsAction(taskId, ctx))

      // Mark as processed so we only trigger once per task
      processedTasks.push(taskId)
    }

    ctx.state.set(STATE_KEY, processedTasks)

    ctx.log.debug({ actionCount: actions.length }, 'Generated deferred-stages actions')
    return actions
  },
}

/**
 * @fileType plugin
 * @domain inspector
 * @pattern deferred-stages-plugin
 * @ai-summary Runs docs then reflect sequentially for tasks that completed PR but missed those stages
 *
 * Docs + reflect were removed from the live pipeline to save 4-10 min and 2 LLM calls per run.
 * This inspector plugin picks up completed tasks and triggers the deferred stages via
 * `cody.yml` workflow dispatch with `mode=rerun from_stage=docs`.
 *
 * Sequential guarantee: triggering from docs means the pipeline runs docs THEN reflect in order,
 * fixing the race condition that existed when they ran in parallel.
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

/**
 * Check if a task has completed PR but is missing docs/reflect outputs.
 * A task is eligible if:
 *   1. The `pr` stage is completed (pipeline finished)
 *   2. Neither docs nor reflect stage is completed
 */
function isEligibleForDeferredStages(taskDir: string, status: TaskStatus): boolean {
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
 * Trigger cody.yml workflow to run docs → reflect for a task.
 */
function createDeferredStagesAction(taskId: string, _ctx: InspectorContext): ActionRequest {
  return {
    plugin: 'cody-deferred-stages',
    type: 'trigger-deferred-stages',
    target: taskId,
    urgency: 'info',
    title: `Run deferred docs+reflect for ${taskId}`,
    detail: `Task ${taskId} completed PR but is missing docs/reflect. Triggering sequential deferred stages.`,
    // Dedup: don't retrigger the same task within 6 hours
    dedupKey: `deferred-stages:${taskId}`,
    dedupWindowMinutes: 360,
    async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
      if (execCtx.dryRun) {
        execCtx.log.info({ taskId }, '[dry-run] Would trigger cody.yml for deferred stages')
        return { success: true, message: 'dry-run: skipped' }
      }

      try {
        execCtx.github.triggerWorkflow('cody.yml', {
          task_id: taskId,
          mode: 'rerun',
          from_stage: 'docs',
        })
        execCtx.log.info({ taskId }, 'Triggered cody.yml for deferred docs+reflect stages')
        return { success: true, message: `Triggered deferred stages for ${taskId}` }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        execCtx.log.error({ taskId, error: msg }, 'Failed to trigger deferred stages')
        return { success: false, message: msg }
      }
    },
  }
}

/**
 * Deferred Stages plugin - runs docs then reflect for tasks that completed the pipeline.
 *
 * Runs every 6th cycle (~30 min) to batch up multiple completed tasks.
 */
export const deferredStagesPlugin: InspectorPlugin = {
  name: 'cody-deferred-stages',
  description: 'Trigger docs + reflect for tasks that completed PR but missed those stages',
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

      if (!isEligibleForDeferredStages(taskDir, status)) {
        // If PR is completed, mark as processed so we don't keep checking
        const stages = status.stages || {}
        const prStage = stages['pr']
        if (prStage?.state === 'completed') {
          processedTasks.push(taskId)
        }
        continue
      }

      ctx.log.info({ taskId }, 'Task eligible for deferred docs+reflect stages')
      actions.push(createDeferredStagesAction(taskId, ctx))

      // Mark as processed so we only trigger once per task
      processedTasks.push(taskId)
    }

    ctx.state.set(STATE_KEY, processedTasks)

    ctx.log.debug({ actionCount: actions.length }, 'Generated deferred-stages actions')
    return actions
  },
}

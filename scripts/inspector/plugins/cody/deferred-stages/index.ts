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
 * Uses evaluated tasks from health-check state (discovered via GitHub API),
 * not the filesystem, to find tasks on feature branches.
 *
 * Complexity gate: only tasks with complexity ≥ 30 are eligible (matching the review threshold).
 * Low-complexity tasks (< 30) skip docs entirely.
 *
 * Note: reflect stage has been removed from the pipeline. Knowledge Gardener (nightly inspector)
 * subsumes reflect functionality.
 */

import type {
  InspectorPlugin,
  ActionRequest,
  InspectorContext,
  EvaluatedTask,
} from '../../../core/types'

const STATE_KEY = 'cody:deferredStagesProcessed'

/** Minimum complexity for docs to run via nightly inspector */
export const DOCS_COMPLEXITY_THRESHOLD = 30

/**
 * Check if a task has completed PR but is missing docs output,
 * and meets the complexity threshold.
 *
 * A task is eligible if:
 *   1. The `pr` stage is completed (pipeline finished)
 *   2. The `docs` stage is not completed
 *   3. Task complexity is ≥ DOCS_COMPLEXITY_THRESHOLD (30)
 */
function isEligibleForDeferredDocs(task: EvaluatedTask, complexity: number): boolean {
  // Must meet complexity threshold
  if (complexity < DOCS_COMPLEXITY_THRESHOLD) {
    return false
  }

  const status = task.status as { stages?: Record<string, { state?: string }> } | null
  const stages = status?.stages || {}

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

  return true
}

/**
 * Extract complexity from task labels.
 * Labels format: "complexity:moderate", "complexity:complex", "complexity:simple"
 */
function getComplexityFromLabels(task: EvaluatedTask): number {
  const label = task.labels.find((l) => l.startsWith('complexity:'))
  if (!label) return 0

  const level = label.split(':')[1]
  switch (level) {
    case 'simple':
      return 10
    case 'moderate':
      return 30
    case 'complex':
      return 60
    case 'very-complex':
      return 90
    default:
      return 0
  }
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
 * Uses evaluated tasks from health-check state (discovered via GitHub API)
 * instead of filesystem scanning, so it can find tasks on feature branches.
 *
 * Runs every 6th cycle (~30 min) to batch up multiple completed tasks.
 */
export const deferredStagesPlugin: InspectorPlugin = {
  name: 'cody-deferred-stages',
  description: 'Trigger docs for tasks (complexity ≥ 30) that completed PR but missed that stage',
  domain: 'cody',
  schedule: { every: 1 }, // Daily

  async run(ctx) {
    ctx.log.debug('Running deferred-stages plugin')

    const processedTasks = ctx.state.get<string[]>(STATE_KEY) || []
    ctx.log.debug({ processedCount: processedTasks.length }, 'Previously processed tasks')

    // Use evaluated tasks from health-check state (discovered via GitHub API)
    const evaluatedTasks = ctx.state.get<EvaluatedTask[]>('cody:evaluatedTasks') || []
    ctx.log.debug({ taskCount: evaluatedTasks.length }, 'Evaluated tasks from health-check')

    const actions: ActionRequest[] = []

    for (const task of evaluatedTasks) {
      // Skip already processed
      if (processedTasks.includes(task.taskId)) {
        ctx.log.debug({ taskId: task.taskId }, 'Skipping already-processed task')
        continue
      }

      // Only consider completed tasks
      if (task.health !== 'completed') {
        continue
      }

      const complexity = getComplexityFromLabels(task)

      if (!isEligibleForDeferredDocs(task, complexity)) {
        // Mark as processed so we don't keep checking
        processedTasks.push(task.taskId)
        // FIX #14: Cap at 200 entries
        while (processedTasks.length > 200) processedTasks.shift()
        continue
      }

      ctx.log.info({ taskId: task.taskId, complexity }, 'Task eligible for deferred docs stage')
      actions.push(createDeferredDocsAction(task.taskId, ctx))

      // Mark as processed so we only trigger once per task
      processedTasks.push(task.taskId)
    }

    ctx.state.set(STATE_KEY, processedTasks)

    ctx.log.debug({ actionCount: actions.length }, 'Generated deferred-stages actions')
    return actions
  },
}

/**
 * @fileType plugin
 * @domain inspector
 * @pattern deferred-tests-plugin
 * @ai-summary Writes tests for tasks that completed PR but have no test coverage yet
 *
 * Test writing was removed from the live pipeline to eliminate the ~200 min worst-case
 * fix loops caused by test-impl mismatches (tests written against plan, not actual code).
 * This inspector plugin picks up completed tasks and triggers the test stage via
 * `cody.yml` workflow dispatch with `mode=rerun from_stage=test`.
 *
 * Uses evaluated tasks from health-check state (discovered via GitHub API),
 * not the filesystem, to find tasks on feature branches.
 *
 * Unlike the deferred-stages (docs) plugin, there is no complexity threshold — every
 * task gets tests. A staleness guard skips tasks older than 7 days.
 */

import type {
  InspectorPlugin,
  ActionRequest,
  InspectorContext,
  EvaluatedTask,
} from '../../../core/types'

const STATE_KEY = 'cody:deferredTestsProcessed'

/** Maximum age (in days) for a task to be eligible for deferred tests */
const MAX_TASK_AGE_DAYS = 7

/**
 * Check if a task is eligible for deferred tests.
 *
 * A task is eligible if:
 *   1. The `pr` stage is completed (pipeline finished)
 *   2. The `test` stage is not completed
 *   3. Task is not older than MAX_TASK_AGE_DAYS (staleness guard)
 */
function isEligibleForDeferredTests(task: EvaluatedTask): boolean {
  const status = task.status as { stages?: Record<string, { state?: string }> } | null
  const stages = status?.stages || {}

  // Must have completed pr stage
  const prStage = stages['pr']
  if (!prStage || prStage.state !== 'completed') {
    return false
  }

  // Check if test is already completed
  const testStage = stages['test']
  if (testStage?.state === 'completed') {
    return false
  }

  // Staleness guard: skip tasks with cody:done label that are old
  // (issueUpdatedAt is used as proxy for task age)
  if (task.issueUpdatedAt) {
    const ageMs = Date.now() - new Date(task.issueUpdatedAt).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    if (ageDays > MAX_TASK_AGE_DAYS) {
      return false
    }
  }

  return true
}

/**
 * Create an action to trigger test writing for a task via cody.yml workflow dispatch.
 */
function createDeferredTestsAction(taskId: string, _ctx: InspectorContext): ActionRequest {
  return {
    plugin: 'cody-deferred-tests',
    type: 'trigger-deferred-tests',
    target: taskId,
    urgency: 'info',
    title: `Run deferred tests for ${taskId}`,
    detail: `Task ${taskId} completed PR but has no test coverage. Triggering deferred test stage.`,
    // Dedup: don't retrigger the same task within 6 hours
    dedupKey: `deferred-tests:${taskId}`,
    dedupWindowMinutes: 360,
    async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
      if (execCtx.dryRun) {
        execCtx.log.info({ taskId }, '[dry-run] Would trigger cody.yml for deferred test stage')
        return { success: true, message: 'dry-run: skipped' }
      }

      try {
        execCtx.github.triggerWorkflow('cody.yml', {
          task_id: taskId,
          mode: 'rerun',
          from_stage: 'test',
          feedback:
            'Deferred test run: write tests for the implemented code on dev. Create a new test branch.',
        })
        execCtx.log.info({ taskId }, 'Triggered cody.yml for deferred test stage')
        return { success: true, message: `Triggered deferred tests for ${taskId}` }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        execCtx.log.error({ taskId, error: msg }, 'Failed to trigger deferred test stage')
        return { success: false, message: msg }
      }
    },
  }
}

/**
 * Deferred Tests plugin — writes tests for tasks that completed the pipeline without test coverage.
 *
 * Uses evaluated tasks from health-check state (discovered via GitHub API)
 * instead of filesystem scanning, so it can find tasks on feature branches.
 *
 * Runs every 6th cycle (~30 min) to batch up multiple completed tasks.
 * No complexity threshold — every task gets tests.
 * Staleness guard: skips tasks older than 7 days.
 */
export const deferredTestsPlugin: InspectorPlugin = {
  name: 'cody-deferred-tests',
  description: 'Trigger test writing for tasks that completed PR but have no test coverage',
  domain: 'cody',
  schedule: { every: 1 }, // Daily

  async run(ctx) {
    ctx.log.debug('Running deferred-tests plugin')

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

      if (!isEligibleForDeferredTests(task)) {
        // Mark as processed so we don't keep checking
        processedTasks.push(task.taskId)
        // FIX #14: Cap at 200 entries
        while (processedTasks.length > 200) processedTasks.shift()
        continue
      }

      ctx.log.info({ taskId: task.taskId }, 'Task eligible for deferred tests')
      actions.push(createDeferredTestsAction(task.taskId, ctx))

      // Mark as processed so we only trigger once per task
      processedTasks.push(task.taskId)
    }

    ctx.state.set(STATE_KEY, processedTasks)

    ctx.log.debug({ actionCount: actions.length }, 'Generated deferred-tests actions')
    return actions
  },
}

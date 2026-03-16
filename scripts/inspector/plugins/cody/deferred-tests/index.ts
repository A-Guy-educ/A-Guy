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
 * Unlike the deferred-stages (docs) plugin, there is no complexity threshold — every
 * task gets tests. A staleness guard skips tasks older than 7 days.
 */

import * as fs from 'fs'
import * as path from 'path'

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'

const STATE_KEY = 'cody:deferredTestsProcessed'

/** Maximum age (in days) for a task to be eligible for deferred tests */
const MAX_TASK_AGE_DAYS = 7

interface StageEntry {
  state?: string
}

interface TaskStatus {
  state?: string
  version?: number
  stages?: Record<string, StageEntry>
  startedAt?: string
}

interface TaskJson {
  complexity?: number
  created_at?: string
}

/**
 * Get the task creation date. Checks task.json first, then status.json startedAt.
 * Returns null if no date can be determined.
 */
function getTaskCreationDate(taskDir: string, status: TaskStatus): Date | null {
  // Try task.json created_at
  const taskJsonPath = path.join(taskDir, 'task.json')
  try {
    if (fs.existsSync(taskJsonPath)) {
      const data = JSON.parse(fs.readFileSync(taskJsonPath, 'utf-8')) as TaskJson
      if (data.created_at) {
        return new Date(data.created_at)
      }
    }
  } catch {
    // Ignore errors
  }

  // Fall back to status.json startedAt
  if (status.startedAt) {
    return new Date(status.startedAt)
  }

  return null
}

/**
 * Check if a task is eligible for deferred tests.
 *
 * A task is eligible if:
 *   1. The `pr` stage is completed (pipeline finished)
 *   2. The `test` stage is not completed
 *   3. test.md output file does not already exist
 *   4. Task is not older than MAX_TASK_AGE_DAYS (staleness guard)
 */
function isEligibleForDeferredTests(taskDir: string, status: TaskStatus): boolean {
  const stages = status.stages || {}

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

  // Check if test.md output file already exists (tests ran outside status tracking)
  const testMdPath = path.join(taskDir, 'test.md')
  if (fs.existsSync(testMdPath)) {
    return false
  }

  // Staleness guard: skip tasks older than MAX_TASK_AGE_DAYS
  const createdDate = getTaskCreationDate(taskDir, status)
  if (createdDate) {
    const ageMs = Date.now() - createdDate.getTime()
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
 * Runs every 6th cycle (~30 min) to batch up multiple completed tasks.
 * No complexity threshold — every task gets tests.
 * Staleness guard: skips tasks older than 7 days.
 */
export const deferredTestsPlugin: InspectorPlugin = {
  name: 'cody-deferred-tests',
  description: 'Trigger test writing for tasks that completed PR but have no test coverage',
  domain: 'cody',
  schedule: { every: 6 }, // Every 6th cycle = every ~30 min

  async run(ctx) {
    ctx.log.debug('Running deferred-tests plugin')

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

      if (!isEligibleForDeferredTests(taskDir, status)) {
        // If PR is completed, mark as processed so we don't keep checking
        const stages = status.stages || {}
        const prStage = stages['pr']
        if (prStage?.state === 'completed') {
          processedTasks.push(taskId)
        }
        continue
      }

      ctx.log.info({ taskId }, 'Task eligible for deferred tests')
      actions.push(createDeferredTestsAction(taskId, ctx))

      // Mark as processed so we only trigger once per task
      processedTasks.push(taskId)
    }

    ctx.state.set(STATE_KEY, processedTasks)

    ctx.log.debug({ actionCount: actions.length }, 'Generated deferred-tests actions')
    return actions
  },
}

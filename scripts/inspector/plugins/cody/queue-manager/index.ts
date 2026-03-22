/**
 * @fileType plugin
 * @domain inspector
 * @pattern queue-manager-plugin
 * @ai-summary Sequential task queue processor — FIFO activation, completion, advancement only.
 *
 * Picks queued tasks one-by-one, runs them through the Cody pipeline, monitors health,
 * and advances the queue on completion or failure. Failure recovery (retries, fix-issues)
 * is delegated to the pipeline-fixer plugin.
 */

import type {
  InspectorPlugin,
  ActionRequest,
  InspectorContext,
  EvaluatedTask,
} from '../../../core/types'
import {
  getQueueState,
  saveQueueState,
  getQueuedTasks,
  getActiveTask,
  activateTask,
  completeTask,
  failTask,
  cleanTaskState,
} from './queue-state'
import type { QueuedTask, QueueState } from './types'
import { STARTUP_GRACE_PERIOD_MS } from './types'

/**
 * Create an action to activate a queued task and trigger its workflow.
 */
function createActivateAction(
  task: QueuedTask,
  queueLength: number,
  _ctx: InspectorContext,
): ActionRequest {
  return {
    plugin: 'cody-queue-manager',
    type: 'activate-task',
    target: task.taskId,
    urgency: 'info',
    title: `Queue: Activate ${task.taskId}`,
    detail: `Starting task (position 1 of ${queueLength})`,
    dedupKey: `queue-activate:${task.taskId}`,
    dedupWindowMinutes: 15,
    execute: async (execCtx: InspectorContext) => {
      // FIX #5: Trigger workflow FIRST — if this throws, state is not yet mutated
      execCtx.github.triggerWorkflow('cody.yml', {
        issue_number: String(task.issueNumber),
        task_id: task.taskId,
        mode: 'full',
      })

      // Workflow dispatched successfully — now update labels and state
      activateTask(execCtx, task)

      let state = getQueueState(execCtx)
      state = {
        ...state,
        activeTaskId: task.taskId,
        activeIssueNumber: task.issueNumber,
        activeStartedAt: new Date().toISOString(),
      }
      saveQueueState(execCtx, state)

      execCtx.github.postComment(
        task.issueNumber,
        `🚀 **Queue Manager**: Starting task (position 1 of ${queueLength})\n\nThis task was picked from the queue and will be processed automatically.`,
      )

      return { success: true, message: `Activated ${task.taskId}` }
    },
  }
}

/**
 * Create an action to mark a task failed and advance to the next queued task.
 * Failure recovery (retries) is handled by the pipeline-fixer plugin.
 */
function createFailAndAdvanceAction(
  task: QueuedTask,
  evaluated: EvaluatedTask,
  _ctx: InspectorContext,
): ActionRequest {
  return {
    plugin: 'cody-queue-manager',
    type: 'fail-and-advance',
    target: task.taskId,
    urgency: 'warning',
    title: `Queue: Fail and advance past ${task.taskId}`,
    detail: `Task failed at ${evaluated.failedStage || 'unknown'} — advancing queue`,
    dedupKey: `queue-fail:${task.taskId}`,
    dedupWindowMinutes: 15,
    execute: async (execCtx: InspectorContext) => {
      failTask(execCtx, task)

      let state = getQueueState(execCtx)
      state = cleanTaskState(state, task.taskId)
      saveQueueState(execCtx, state)

      execCtx.github.postComment(
        task.issueNumber,
        `⏭️ **Queue Manager**: Task failed — advancing queue. The pipeline-fixer will handle retries.`,
      )

      advanceQueue(execCtx, state)

      return { success: true, message: `Failed ${task.taskId}, advanced queue` }
    },
  }
}

/**
 * Create an action to complete a task and advance the queue.
 */
function createCompleteAction(task: QueuedTask, _ctx: InspectorContext): ActionRequest {
  return {
    plugin: 'cody-queue-manager',
    type: 'complete-task',
    target: task.taskId,
    urgency: 'info',
    title: `Queue: Complete ${task.taskId}`,
    detail: `Task completed successfully`,
    dedupKey: `queue-complete:${task.taskId}`,
    dedupWindowMinutes: 30,
    execute: async (execCtx: InspectorContext) => {
      completeTask(execCtx, task)

      let state = getQueueState(execCtx)
      state = cleanTaskState(state, task.taskId)
      saveQueueState(execCtx, state)

      const queued = getQueuedTasks(execCtx)
      const nextTask = queued.length > 0 ? queued[0] : null

      if (nextTask) {
        // FIX #5: Trigger workflow FIRST — if this throws, we still completed the current task
        execCtx.github.triggerWorkflow('cody.yml', {
          issue_number: String(nextTask.issueNumber),
          task_id: nextTask.taskId,
          mode: 'full',
        })

        activateTask(execCtx, nextTask)
        const newState: typeof state = {
          ...state,
          activeTaskId: nextTask.taskId,
          activeIssueNumber: nextTask.issueNumber,
          activeStartedAt: new Date().toISOString(),
        }
        saveQueueState(execCtx, newState)

        execCtx.github.postComment(
          task.issueNumber,
          `✅ **Queue Manager**: Task completed! Starting next task: #${nextTask.issueNumber} (${nextTask.title})`,
        )
        execCtx.github.postComment(
          nextTask.issueNumber,
          `🚀 **Queue Manager**: Starting task (advanced from completed #${task.issueNumber})`,
        )
      } else {
        execCtx.github.postComment(
          task.issueNumber,
          `✅ **Queue Manager**: Task completed! Queue is now empty.`,
        )
      }

      return {
        success: true,
        message: `Completed ${task.taskId}${nextTask ? `, advancing to ${nextTask.taskId}` : ''}`,
      }
    },
  }
}

/**
 * Try to advance the queue to the next task after a failure/completion.
 */
function advanceQueue(ctx: InspectorContext, state: QueueState): void {
  const queued = getQueuedTasks(ctx)
  if (queued.length === 0) return

  const nextTask = queued[0]

  // FIX #5: Trigger workflow FIRST — if this throws, queue state is clean (no active task)
  // and the next cycle will pick up the queued task again
  try {
    ctx.github.triggerWorkflow('cody.yml', {
      issue_number: String(nextTask.issueNumber),
      task_id: nextTask.taskId,
      mode: 'full',
    })
  } catch (error) {
    ctx.log.error(
      { taskId: nextTask.taskId, error: String(error) },
      'Failed to trigger workflow for next queue task — will retry next cycle',
    )
    return
  }

  activateTask(ctx, nextTask)

  const newState: QueueState = {
    ...state,
    activeTaskId: nextTask.taskId,
    activeIssueNumber: nextTask.issueNumber,
    activeStartedAt: new Date().toISOString(),
  }
  saveQueueState(ctx, newState)

  ctx.github.postComment(
    nextTask.issueNumber,
    `🚀 **Queue Manager**: Starting task (advanced from queue)`,
  )
}

/**
 * Queue Manager Plugin.
 *
 * Runs every cycle (5 min). Depends on health-check plugin's evaluatedTasks in state.
 * Only manages the queue: FIFO activation, completion, advancement.
 * Failure recovery is delegated to the pipeline-fixer plugin.
 */
export const queueManagerPlugin: InspectorPlugin = {
  name: 'cody-queue-manager',
  description: 'Sequential task queue processor — activation, completion, and advancement',
  domain: 'cody',
  schedule: { every: 1 }, // Daily

  async run(ctx) {
    ctx.log.debug('Running queue-manager plugin')

    const state = getQueueState(ctx)
    const evaluatedTasks = ctx.state.get<EvaluatedTask[]>('cody:evaluatedTasks') || []

    const activeTask = getActiveTask(ctx)

    if (!activeTask) {
      const queued = getQueuedTasks(ctx)

      if (queued.length === 0) {
        ctx.log.debug('Queue empty, no active task')
        return []
      }

      ctx.log.info({ queueLength: queued.length }, 'No active task, activating next from queue')
      return [createActivateAction(queued[0], queued.length, ctx)]
    }

    ctx.log.debug({ taskId: activeTask.taskId }, 'Active task found, checking health')

    const evaluated = evaluatedTasks.find((t) => t.issueNumber === activeTask.issueNumber)

    if (!evaluated) {
      const startedAt = state.activeStartedAt ? new Date(state.activeStartedAt).getTime() : 0
      const elapsed = Date.now() - startedAt

      if (elapsed < STARTUP_GRACE_PERIOD_MS) {
        ctx.log.debug(
          { taskId: activeTask.taskId, elapsedMs: elapsed },
          'Active task not in evaluatedTasks yet — within grace period',
        )
        return []
      }

      ctx.log.warn(
        { taskId: activeTask.taskId },
        'Active task not in evaluatedTasks after grace period — treating as failed',
      )
      const syntheticEvaluated: EvaluatedTask = {
        taskId: activeTask.taskId,
        issueNumber: activeTask.issueNumber,
        issueTitle: activeTask.title,
        labels: activeTask.labels,
        status: null,
        issueUpdatedAt: activeTask.updatedAt,
        statusUpdatedAt: null,
        health: 'failed',
        healthDetail: 'Task not found in evaluatedTasks after grace period',
        failedStage: 'unknown',
        failedError: 'Task disappeared from health check after 10 minutes',
      }
      return [createFailAndAdvanceAction(activeTask, syntheticEvaluated, ctx)]
    }

    const actions: ActionRequest[] = []

    switch (evaluated.health) {
      case 'healthy':
        ctx.log.debug({ taskId: activeTask.taskId }, 'Active task healthy, waiting')
        break

      case 'failed':
        ctx.log.info({ taskId: activeTask.taskId }, 'Active task failed, failing and advancing')
        actions.push(createFailAndAdvanceAction(activeTask, evaluated, ctx))
        break

      case 'completed':
        ctx.log.info({ taskId: activeTask.taskId }, 'Active task completed')
        actions.push(createCompleteAction(activeTask, ctx))
        break

      case 'orphaned':
      case 'stalled': {
        ctx.log.warn(
          { taskId: activeTask.taskId, health: evaluated.health },
          'Active task orphaned/stalled — treating as failed',
        )
        const failedEval: EvaluatedTask = {
          ...evaluated,
          health: 'failed',
          failedStage: evaluated.failedStage || 'unknown',
          failedError:
            evaluated.failedError || `Task is ${evaluated.health}: ${evaluated.healthDetail}`,
        }
        actions.push(createFailAndAdvanceAction(activeTask, failedEval, ctx))
        break
      }

      case 'gated':
        // No gate handling — wait for human or let it time out
        ctx.log.debug({ taskId: activeTask.taskId }, 'Active task gated — waiting for approval')
        break

      case 'unknown': {
        const startedAt = state.activeStartedAt ? new Date(state.activeStartedAt).getTime() : 0
        const elapsed = Date.now() - startedAt

        if (elapsed < STARTUP_GRACE_PERIOD_MS) {
          ctx.log.debug(
            { taskId: activeTask.taskId, elapsedMs: elapsed },
            'Active task health unknown — within grace period',
          )
        } else {
          ctx.log.warn(
            { taskId: activeTask.taskId },
            'Active task health unknown after grace period — treating as failed',
          )
          const failedEval: EvaluatedTask = {
            ...evaluated,
            health: 'failed',
            failedStage: 'unknown',
            failedError: 'Task health unknown after grace period',
          }
          actions.push(createFailAndAdvanceAction(activeTask, failedEval, ctx))
        }
        break
      }

      default:
        ctx.log.warn(
          { taskId: activeTask.taskId, health: evaluated.health },
          'Unexpected health status',
        )
    }

    return actions
  },
}

/**
 * @fileType plugin
 * @domain inspector
 * @pattern queue-manager-plugin
 * @ai-summary Autonomous sequential task queue processor with AI gate approval and failure recovery
 *
 * Picks queued tasks one-by-one, runs them through the Cody pipeline, auto-approves gates
 * using AI review, monitors for failures, and retries up to 2 times — all without human intervention.
 */

import type {
  InspectorPlugin,
  ActionRequest,
  InspectorContext,
  EvaluatedTask,
} from '../../../core/types'
import { readTaskFile } from '../../../clients/github'
import { classifyRetryability } from '../failure-analysis/classifier'
import { analyzeFailure } from '../failure-analysis/analyzer'
import { resolveFromStage } from '../failure-analysis/stage-router'
import { reviewGate } from './gate-reviewer'
import {
  getQueueState,
  saveQueueState,
  getQueuedTasks,
  getActiveTask,
  activateTask,
  completeTask,
  failTask,
  getRetryCount,
  incrementRetry,
  cleanTaskState,
} from './queue-state'
import type { QueuedTask, QueueState } from './types'
import { MAX_RETRIES, STARTUP_GRACE_PERIOD_MS } from './types'

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
      activateTask(execCtx, task)

      // Update queue state
      let state = getQueueState(execCtx)
      state = {
        ...state,
        activeTaskId: task.taskId,
        activeIssueNumber: task.issueNumber,
        activeStartedAt: new Date().toISOString(),
      }
      saveQueueState(execCtx, state)

      // Trigger the pipeline
      execCtx.github.triggerWorkflow('cody.yml', {
        task_id: task.taskId,
        mode: 'full',
      })

      execCtx.github.postComment(
        task.issueNumber,
        `🚀 **Queue Manager**: Starting task (position 1 of ${queueLength})\n\nThis task was picked from the queue and will be processed automatically.`,
      )

      return { success: true, message: `Activated ${task.taskId}` }
    },
  }
}

/**
 * Create an action to review a gated task.
 */
function createGateReviewAction(
  task: QueuedTask,
  evaluated: EvaluatedTask,
  _ctx: InspectorContext,
): ActionRequest {
  return {
    plugin: 'cody-queue-manager',
    type: 'gate-review',
    target: task.taskId,
    urgency: 'warning',
    title: `Queue: Review gate for ${task.taskId}`,
    detail: `Task is gated at ${evaluated.failedStage || 'unknown stage'}`,
    dedupKey: `queue-gate:${task.taskId}`,
    dedupWindowMinutes: 15,
    execute: async (execCtx: InspectorContext) => {
      const issueData = execCtx.github.getIssue(task.issueNumber)
      const requirement = issueData.body || 'No requirement found'

      // Try to read gate-relevant files
      const taskJson = readTaskFile(task.taskId, 'task.json')
      const planMd = readTaskFile(task.taskId, 'plan.md')
      const specMd = readTaskFile(task.taskId, 'spec.md')
      const gateOutput = taskJson || planMd || specMd || 'No gate output available'

      // Determine gate name from the evaluated task's failed stage or pipeline info
      const gateName = evaluated.failedStage || 'unknown'

      const result = await reviewGate({
        requirement,
        gateOutput,
        gateName,
        taskId: task.taskId,
      })

      let state = getQueueState(execCtx)

      if (result.approved) {
        // Post approval comment with /cody approve command
        execCtx.github.postComment(
          task.issueNumber,
          `/cody approve\n\n**[queue-manager]** AI Review: ✅ Approved (confidence: ${(result.confidence * 100).toFixed(0)}%)\n\n${result.feedback}`,
        )

        // Track gate approval
        const prevApprovals = state.gateApprovals[task.taskId] || []
        state = {
          ...state,
          gateApprovals: {
            ...state.gateApprovals,
            [task.taskId]: [...prevApprovals, gateName],
          },
        }
        saveQueueState(execCtx, state)

        return { success: true, message: `Gate approved for ${task.taskId}` }
      } else {
        // Post rejection feedback and trigger rerun
        execCtx.github.postComment(
          task.issueNumber,
          `**[queue-manager]** AI Review: ❌ Changes requested (confidence: ${(result.confidence * 100).toFixed(0)}%)\n\n${result.feedback}`,
        )

        // Trigger rerun with the feedback
        const fromStage = resolveFromStage(gateName)
        execCtx.github.triggerWorkflow('cody.yml', {
          task_id: task.taskId,
          mode: 'rerun',
          from_stage: fromStage,
          feedback: result.feedback,
        })

        return { success: true, message: `Gate rejected for ${task.taskId}, rerun triggered` }
      }
    },
  }
}

/**
 * Create an action to handle a failed task — retry or fail permanently.
 */
function createFailureAction(
  task: QueuedTask,
  evaluated: EvaluatedTask,
  _ctx: InspectorContext,
): ActionRequest {
  return {
    plugin: 'cody-queue-manager',
    type: 'handle-failure',
    target: task.taskId,
    urgency: 'critical',
    title: `Queue: Handle failure for ${task.taskId}`,
    detail: `Task failed at ${evaluated.failedStage || 'unknown'}: ${evaluated.failedError || 'unknown error'}`,
    dedupKey: `queue-retry:${task.taskId}`,
    dedupWindowMinutes: 15,
    execute: async (execCtx: InspectorContext) => {
      let state = getQueueState(execCtx)
      const retryCount = getRetryCount(state, task.taskId)

      // Check if retries exhausted
      if (retryCount >= MAX_RETRIES) {
        failTask(execCtx, task)
        state = cleanTaskState(state, task.taskId)
        saveQueueState(execCtx, state)

        execCtx.github.postComment(
          task.issueNumber,
          `⛔ **Queue Manager**: Max retries exhausted (${retryCount}/${MAX_RETRIES})\n\nManual intervention required. Review the failure history and either:\n- Fix the issue manually and close\n- Refine the issue description and re-add to queue`,
        )

        // Try to advance to next task
        advanceQueue(execCtx, state)

        return { success: true, message: `Max retries exhausted for ${task.taskId}` }
      }

      // Pre-classify retryability
      const classification = classifyRetryability(
        evaluated.failedStage || 'unknown',
        evaluated.failedError || '',
      )

      if (!classification.canRetry) {
        failTask(execCtx, task)
        state = cleanTaskState(state, task.taskId)
        saveQueueState(execCtx, state)

        execCtx.github.postComment(
          task.issueNumber,
          `⛔ **Queue Manager**: Non-retryable failure\n\n**Category:** ${classification.category}\n**Reason:** ${classification.reason}\n\nManual intervention required.`,
        )

        advanceQueue(execCtx, state)

        return { success: true, message: `Non-retryable failure for ${task.taskId}` }
      }

      // Increment retry count
      state = incrementRetry(state, task.taskId)
      const currentAttempt = getRetryCount(state, task.taskId)
      saveQueueState(execCtx, state)

      // For format-only failures, skip LLM analysis
      if (classification.category === 'format-only') {
        const fromStage = resolveFromStage(evaluated.failedStage || 'build')
        execCtx.github.postComment(
          task.issueNumber,
          `🔄 **[queue-manager-retry: ${currentAttempt}/${MAX_RETRIES}]** Format-only failure. Auto-retrying from \`${fromStage}\`.`,
        )
        execCtx.github.triggerWorkflow('cody.yml', {
          task_id: task.taskId,
          mode: 'rerun',
          from_stage: fromStage,
          feedback: 'Format-only failure — run lint:fix and format:fix before verify.',
        })
        return { success: true, message: `Format-only retry triggered for ${task.taskId}` }
      }

      // Full LLM analysis
      const requirement =
        execCtx.github.getIssue(task.issueNumber).body || 'No issue body available'
      const stageOutput = readTaskFile(task.taskId, `${evaluated.failedStage}.md`)
      const verifyOutput = readTaskFile(task.taskId, 'verify.md')
      const previousFeedback = readTaskFile(task.taskId, 'rerun-feedback.md')

      const analysis = await analyzeFailure({
        requirement,
        errorMessage: evaluated.failedError || 'Unknown error',
        failedStage: evaluated.failedStage || 'unknown',
        stageOutput,
        verifyOutput: verifyOutput || undefined,
        previousFeedback: previousFeedback || undefined,
        retryNumber: currentAttempt,
      })

      const fromStage = resolveFromStage(evaluated.failedStage || 'build')

      execCtx.github.postComment(
        task.issueNumber,
        `🔄 **[queue-manager-retry: ${currentAttempt}/${MAX_RETRIES}]** Failure Analysis\n\n**Failed stage:** \`${evaluated.failedStage}\`\n**Root cause:** ${analysis.rootCause}\n\n${analysis.canRetry ? `Retrying from \`${fromStage}\`...` : 'No retry possible — manual intervention required.'}`,
      )

      if (analysis.canRetry && analysis.refinedFeedback) {
        execCtx.github.triggerWorkflow('cody.yml', {
          task_id: task.taskId,
          mode: 'rerun',
          from_stage: fromStage,
          feedback: analysis.refinedFeedback,
        })
        return { success: true, message: `Retry triggered from ${fromStage}` }
      }

      // Analysis says no retry possible
      failTask(execCtx, task)
      state = cleanTaskState(state, task.taskId)
      saveQueueState(execCtx, state)
      advanceQueue(execCtx, state)

      return { success: true, message: 'Analysis posted, no retry possible' }
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

      // Check for next task
      const queued = getQueuedTasks(execCtx)
      const nextTask = queued.length > 0 ? queued[0] : null

      if (nextTask) {
        activateTask(execCtx, nextTask)
        const newState: typeof state = {
          ...state,
          activeTaskId: nextTask.taskId,
          activeIssueNumber: nextTask.issueNumber,
          activeStartedAt: new Date().toISOString(),
        }
        saveQueueState(execCtx, newState)

        execCtx.github.triggerWorkflow('cody.yml', {
          task_id: nextTask.taskId,
          mode: 'full',
        })

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
  activateTask(ctx, nextTask)

  const newState: QueueState = {
    ...state,
    activeTaskId: nextTask.taskId,
    activeIssueNumber: nextTask.issueNumber,
    activeStartedAt: new Date().toISOString(),
  }
  saveQueueState(ctx, newState)

  ctx.github.triggerWorkflow('cody.yml', {
    task_id: nextTask.taskId,
    mode: 'full',
  })

  ctx.github.postComment(
    nextTask.issueNumber,
    `🚀 **Queue Manager**: Starting task (advanced from queue)`,
  )
}

/**
 * Queue Manager Plugin.
 *
 * Runs every cycle (5 min). Depends on health-check plugin's evaluatedTasks in state.
 */
export const queueManagerPlugin: InspectorPlugin = {
  name: 'cody-queue-manager',
  description:
    'Autonomous sequential task queue processor with AI gate approval and failure recovery',
  domain: 'cody',

  async run(ctx) {
    ctx.log.debug('Running queue-manager plugin')

    const state = getQueueState(ctx)
    const evaluatedTasks = ctx.state.get<EvaluatedTask[]>('cody:evaluatedTasks') || []

    // Check for active task
    const activeTask = getActiveTask(ctx)

    if (!activeTask) {
      // No active task — pick next from queue
      const queued = getQueuedTasks(ctx)

      if (queued.length === 0) {
        ctx.log.debug('Queue empty, no active task')
        return []
      }

      ctx.log.info({ queueLength: queued.length }, 'No active task, activating next from queue')
      return [createActivateAction(queued[0], queued.length, ctx)]
    }

    // Active task found — check its health
    ctx.log.debug({ taskId: activeTask.taskId }, 'Active task found, checking health')

    const evaluated = evaluatedTasks.find((t) => t.issueNumber === activeTask.issueNumber)

    if (!evaluated) {
      // Task not found in evaluatedTasks — check if recently activated
      const startedAt = state.activeStartedAt ? new Date(state.activeStartedAt).getTime() : 0
      const elapsed = Date.now() - startedAt

      if (elapsed < STARTUP_GRACE_PERIOD_MS) {
        ctx.log.debug(
          { taskId: activeTask.taskId, elapsedMs: elapsed },
          'Active task not in evaluatedTasks yet — within grace period',
        )
        return []
      }

      // Grace period expired — treat as failed
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
      return [createFailureAction(activeTask, syntheticEvaluated, ctx)]
    }

    // Route based on health
    const actions: ActionRequest[] = []

    switch (evaluated.health) {
      case 'healthy':
        // Task is running — wait
        ctx.log.debug({ taskId: activeTask.taskId }, 'Active task healthy, waiting')
        break

      case 'gated':
        ctx.log.info({ taskId: activeTask.taskId }, 'Active task gated, creating review action')
        actions.push(createGateReviewAction(activeTask, evaluated, ctx))
        break

      case 'failed':
        ctx.log.info({ taskId: activeTask.taskId }, 'Active task failed, creating failure action')
        actions.push(createFailureAction(activeTask, evaluated, ctx))
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
        actions.push(createFailureAction(activeTask, failedEval, ctx))
        break
      }

      case 'unknown': {
        // Check if recently activated
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
          actions.push(createFailureAction(activeTask, failedEval, ctx))
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

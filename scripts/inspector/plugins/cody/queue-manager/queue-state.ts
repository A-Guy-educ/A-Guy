/**
 * @fileType utility
 * @domain inspector
 * @pattern queue-state
 * @ai-summary Queue state management helpers — read/write state, label operations, retry tracking
 */

import type { InspectorContext } from '../../../core/types'
import type { QueueState, QueuedTask } from './types'
import { QUEUE_LABELS, DEFAULT_QUEUE_STATE } from './types'

const STATE_KEY = 'queue:state'

/**
 * Get the persisted queue state from the inspector state store.
 * Returns defaults if no state exists yet.
 */
export function getQueueState(ctx: InspectorContext): QueueState {
  return ctx.state.get<QueueState>(STATE_KEY) ?? { ...DEFAULT_QUEUE_STATE }
}

/**
 * Save queue state to the inspector state store.
 */
export function saveQueueState(ctx: InspectorContext, state: QueueState): void {
  ctx.state.set(STATE_KEY, state)
}

/**
 * Get all queued tasks (label: cody:queued), sorted by updatedAt ascending (FIFO).
 */
export function getQueuedTasks(ctx: InspectorContext): QueuedTask[] {
  const issues = ctx.github.getOpenIssues([QUEUE_LABELS.QUEUED])
  return issues
    .map((issue) => ({
      issueNumber: issue.number,
      title: issue.title,
      labels: issue.labels,
      updatedAt: issue.updatedAt,
      taskId: `issue-${issue.number}`,
    }))
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
}

/**
 * Get the currently active queue task (label: cody:queue-active), or null.
 */
export function getActiveTask(ctx: InspectorContext): QueuedTask | null {
  const issues = ctx.github.getOpenIssues([QUEUE_LABELS.ACTIVE])
  if (issues.length === 0) return null
  const issue = issues[0]
  return {
    issueNumber: issue.number,
    title: issue.title,
    labels: issue.labels,
    updatedAt: issue.updatedAt,
    taskId: `issue-${issue.number}`,
  }
}

/**
 * Activate a task: remove cody:queued, add cody:queue-active.
 */
export function activateTask(ctx: InspectorContext, task: QueuedTask): void {
  ctx.github.removeLabel(task.issueNumber, QUEUE_LABELS.QUEUED)
  ctx.github.addLabel(task.issueNumber, QUEUE_LABELS.ACTIVE)
}

/**
 * Complete a task: remove cody:queue-active label.
 */
export function completeTask(ctx: InspectorContext, task: QueuedTask): void {
  ctx.github.removeLabel(task.issueNumber, QUEUE_LABELS.ACTIVE)
}

/**
 * Fail a task: remove cody:queue-active, add cody:queue-failed.
 */
export function failTask(ctx: InspectorContext, task: QueuedTask): void {
  ctx.github.removeLabel(task.issueNumber, QUEUE_LABELS.ACTIVE)
  ctx.github.addLabel(task.issueNumber, QUEUE_LABELS.FAILED)
}

/**
 * Get the retry count for a task.
 */
export function getRetryCount(state: QueueState, taskId: string): number {
  return state.retries[taskId] ?? 0
}

/**
 * Return a new state with an incremented retry count for the given task.
 */
export function incrementRetry(state: QueueState, taskId: string): QueueState {
  return {
    ...state,
    retries: {
      ...state.retries,
      [taskId]: (state.retries[taskId] ?? 0) + 1,
    },
  }
}

/**
 * Clean up retry and gate approval state for a completed/failed task.
 */
export function cleanTaskState(state: QueueState, taskId: string): QueueState {
  const { [taskId]: _retries, ...remainingRetries } = state.retries
  const { [taskId]: _gates, ...remainingGates } = state.gateApprovals
  return {
    ...state,
    activeTaskId: null,
    activeIssueNumber: null,
    activeStartedAt: null,
    retries: remainingRetries,
    gateApprovals: remainingGates,
  }
}

/**
 * @fileType types
 * @domain inspector
 * @pattern queue-manager-types
 * @ai-summary Types for the queue manager plugin — queue state and task types
 */

// ============================================================================
// Queue Labels
// ============================================================================

export const QUEUE_LABELS = {
  QUEUED: 'cody:queued',
  ACTIVE: 'cody:queue-active',
  FAILED: 'cody:queue-failed',
} as const

// ============================================================================
// Queue State (persisted across inspector cycles)
// ============================================================================

export interface QueueState {
  /** Task ID of the currently active queue task, or null */
  activeTaskId: string | null
  /** Issue number of the currently active queue task, or null */
  activeIssueNumber: number | null
  /** ISO timestamp when the active task was started */
  activeStartedAt: string | null
}

// ============================================================================
// Queued Task
// ============================================================================

export interface QueuedTask {
  issueNumber: number
  title: string
  labels: string[]
  updatedAt: string
  /** Derived task ID (e.g. 'issue-42') */
  taskId: string
}

// ============================================================================
// Constants
// ============================================================================

export const STARTUP_GRACE_PERIOD_MS = 10 * 60 * 1000 // 10 minutes

export const DEFAULT_QUEUE_STATE: QueueState = {
  activeTaskId: null,
  activeIssueNumber: null,
  activeStartedAt: null,
}

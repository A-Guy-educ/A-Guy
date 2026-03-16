/**
 * @fileType types
 * @domain inspector
 * @pattern queue-manager-types
 * @ai-summary Types for the queue manager plugin — queue state, gate review I/O
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
  /** Map of taskId → retry count (0-2) */
  retries: Record<string, number>
  /** Map of taskId → list of auto-approved gate stage names */
  gateApprovals: Record<string, string[]>
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
// Gate Review
// ============================================================================

export interface GateReviewInput {
  /** Original requirement (issue body) */
  requirement: string
  /** Gate output content (task.json or plan.md) */
  gateOutput: string
  /** Name of the gate stage (e.g. 'taskify', 'architect') */
  gateName: string
  /** Task ID for tracking */
  taskId: string
}

export interface GateReviewResult {
  /** Whether the gate is approved */
  approved: boolean
  /** Feedback message (always non-empty) */
  feedback: string
  /** Confidence score 0-1 */
  confidence: number
}

// ============================================================================
// Constants
// ============================================================================

// MAX_RETRIES = 2 for autonomous queue processing (fail fast, move to next task).
// Failure-analysis uses MAX_RETRIES = 3 for human-initiated tasks.
export const MAX_RETRIES = 2
export const STARTUP_GRACE_PERIOD_MS = 10 * 60 * 1000 // 10 minutes

export const DEFAULT_QUEUE_STATE: QueueState = {
  activeTaskId: null,
  activeIssueNumber: null,
  activeStartedAt: null,
  retries: {},
  gateApprovals: {},
}

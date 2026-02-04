/**
 * Conversion Job State Machine
 *
 * Manages state transitions for conversion jobs with validation and side effects
 *
 * @fileType service
 * @domain backend
 * @pattern state-machine
 * @ai-summary State machine for conversion job status transitions
 */

import type { ConversionJobStatus } from '../jobs/types'

// Define valid state transitions
export const VALID_TRANSITIONS: Record<ConversionJobStatus, ConversionJobStatus[]> = {
  draft: ['queued'],
  queued: ['running', 'cancelled'],
  running: ['paused', 'review', 'completed', 'failed', 'cancelled'],
  paused: ['running', 'cancelled'],
  review: ['running', 'completed', 'cancelled'],
  completed: [],
  failed: ['queued'],
  cancelled: [],
}

// Define which states allow manual review
export const REVIEW_GATE_STAGES: ConversionJobStatus[] = ['review']

// Define stage order for progress tracking
export const STAGE_ORDER: ConversionJobStatus[] = [
  'draft',
  'queued',
  'running',
  'review',
  'completed',
]

// Terminal states (no further transitions possible)
export const TERMINAL_STATES: ConversionJobStatus[] = ['completed', 'cancelled']

// States that indicate active processing
export const ACTIVE_STATES: ConversionJobStatus[] = ['running', 'review']

// States that indicate waiting
export const WAITING_STATES: ConversionJobStatus[] = ['queued', 'paused']

/**
 * Check if a transition from one state to another is valid
 */
export function isValidTransition(from: ConversionJobStatus, to: ConversionJobStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Get the next stage after completing review
 */
export function getNextStageAfterReview(currentStatus: ConversionJobStatus): ConversionJobStatus {
  if (currentStatus !== 'review') {
    throw new Error('Can only call this when current status is review')
  }
  return 'running'
}

/**
 * Determine if job should pause for review at a given point
 */
export function shouldPauseForReview(
  status: ConversionJobStatus,
  reviewMode: string,
  config?: { pauseAfterSegment?: boolean; confidenceThreshold?: number },
): boolean {
  if (status !== 'running') return false

  switch (reviewMode) {
    case 'segment':
      return config?.pauseAfterSegment ?? true
    case 'batch':
      return false
    case 'manual':
      return true
    case 'auto':
      return false
    default:
      return false
  }
}

/**
 * Get a human-readable label for a status
 */
export function getStatusLabel(status: ConversionJobStatus): string {
  const labels: Record<ConversionJobStatus, string> = {
    draft: 'Draft',
    queued: 'Queued',
    running: 'Running',
    paused: 'Paused',
    review: 'In Review',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }
  return labels[status] ?? status
}

/**
 * Get CSS class for status badge
 */
export function getStatusClass(status: ConversionJobStatus): string {
  const classes: Record<ConversionJobStatus, string> = {
    draft: 'status-draft',
    queued: 'status-queued',
    running: 'status-running',
    paused: 'status-paused',
    review: 'status-review',
    completed: 'status-completed',
    failed: 'status-failed',
    cancelled: 'status-cancelled',
  }
  return classes[status] ?? 'status-unknown'
}

/**
 * Calculate overall progress percentage
 */
export function calculateProgress(
  status: ConversionJobStatus,
  progress: {
    totalSegments: number
    completedSegments: number
    totalExercises: number
    approvedExercises: number
  },
): number {
  if (status === 'draft' || status === 'queued') return 0
  if (status === 'completed') return 100

  // Weighted progress: 70% from segment completion, 30% from exercise approval
  const segmentProgress =
    progress.totalSegments > 0 ? (progress.completedSegments / progress.totalSegments) * 70 : 0
  const exerciseProgress =
    progress.totalExercises > 0 ? (progress.approvedExercises / progress.totalExercises) * 30 : 0

  return Math.min(Math.round(segmentProgress + exerciseProgress), 99)
}

/**
 * Determine if job can be retried
 */
export function canRetry(status: ConversionJobStatus): boolean {
  return status === 'failed'
}

/**
 * Determine if job can be cancelled
 */
export function canCancel(status: ConversionJobStatus): boolean {
  return !TERMINAL_STATES.includes(status)
}

/**
 * Determine if job is in a terminal state
 */
export function isTerminal(status: ConversionJobStatus): boolean {
  return TERMINAL_STATES.includes(status)
}

/**
 * Get allowed actions for current status
 */
export function getAllowedActions(status: ConversionJobStatus): string[] {
  const actions: Record<ConversionJobStatus, string[]> = {
    draft: ['start'],
    queued: ['cancel'],
    running: ['pause', 'cancel'],
    paused: ['resume', 'cancel'],
    review: ['approve', 'skip', 'cancel'],
    completed: [],
    failed: ['retry'],
    cancelled: [],
  }
  return actions[status] ?? []
}

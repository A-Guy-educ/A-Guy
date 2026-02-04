/**
 * Conversion Review Service
 *
 * Handles all review actions for conversion jobs:
 * - Stage approval
 * - Segment approval/skipping
 * - Exercise approval/rejection/editing
 * - Bulk operations
 * - Finalization
 *
 * This module exports types and helper functions. The actual service logic
 * is implemented in the endpoint handlers to maintain Payload API access patterns.
 */

import type { JobStage } from '../jobs/types'

// ============================================
// State Machine Definitions
// ============================================

export const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['queued'],
  queued: ['running', 'cancelled'],
  running: ['paused', 'review', 'completed', 'failed', 'cancelled'],
  paused: ['running', 'cancelled'],
  review: ['running', 'completed', 'cancelled'],
  completed: [],
  failed: ['queued'],
  cancelled: [],
}

export const REVIEW_GATE_STAGES: JobStage[] = [
  'SEGMENT_QUEUE',
  'SEGMENT_REVIEW',
  'VERIFICATION_REVIEW',
  'FINAL_APPROVAL',
]

export const STAGE_FLOW: Record<JobStage, JobStage> = {
  INIT: 'PDF_PREVIEW',
  PDF_PREVIEW: 'CONFIGURATION',
  CONFIGURATION: 'PDF_LOAD',
  PDF_LOAD: 'PDF_SEGMENT',
  PDF_SEGMENT: 'SEGMENT_QUEUE',
  SEGMENT_QUEUE: 'SEGMENT_EXTRACT',
  SEGMENT_EXTRACT: 'SEGMENT_REVIEW',
  SEGMENT_REVIEW: 'ROUND_PROCESSING',
  ROUND_PROCESSING: 'SEGMENT_VERIFY',
  SEGMENT_VERIFY: 'VERIFICATION_REVIEW',
  VERIFICATION_REVIEW: 'SEGMENT_PERSIST',
  SEGMENT_PERSIST: 'FINAL_APPROVAL',
  FINAL_APPROVAL: 'COMPLETE',
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  PAUSED: 'PAUSED',
}

// ============================================
// Helper Functions
// ============================================

/**
 * Validate state transition
 */
export function isValidTransition(currentStatus: string, newStatus: string): boolean {
  const valid = VALID_TRANSITIONS[currentStatus]
  return valid?.includes(newStatus) ?? false
}

/**
 * Check if stage should pause for review based on review mode
 */
export function shouldPauseForReview(stage: JobStage, reviewMode: string): boolean {
  if (reviewMode === 'auto') return false
  if (reviewMode === 'manual') return true
  return REVIEW_GATE_STAGES.includes(stage)
}

/**
 * Get the next stage after review approval
 */
export function getNextStageAfterReview(
  currentStage: JobStage,
  action: 'approve' | 'skip',
): JobStage {
  if (action === 'skip') {
    return 'SEGMENT_PERSIST'
  }
  return STAGE_FLOW[currentStage] || currentStage
}

/**
 * Create log entry for review action
 */
export function createReviewLogEntry(
  stage: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  details?: Record<string, unknown>,
) {
  return {
    timestamp: new Date().toISOString(),
    level,
    stage,
    message,
    details,
  }
}

// ============================================
// Types (re-exported for convenience)
// ============================================

export interface ReviewActionInput {
  action: 'approve' | 'reject' | 'skip'
  segmentIndex?: number
  exerciseIndices?: number[]
  reason?: string
}

export interface EditExerciseInput {
  title?: string
  content?: Record<string, unknown>
  adminNotes?: string
}

export interface ApproveStageInput {
  jobId: string
  action?: 'approve' | 'skip'
  segmentIndex?: number
  exerciseIndices?: number[]
}

// ============================================
// Service Interface (for documentation)
// ============================================

/**
 * Review Service Interface
 *
 * The actual implementation is in the endpoint handlers following Payload patterns.
 * This interface documents the expected behavior:
 *
 * - approveStage(jobId, action) - Approve current review stage
 * - approveSegment(jobId, segmentIndex) - Approve segment
 * - skipSegment(jobId, segmentIndex) - Skip segment
 * - getPendingExercises(jobId) - Get review queue
 * - approveExercise(jobId, exerciseIndex) - Approve exercise
 * - rejectExercise(jobId, exerciseIndex, reason) - Reject exercise
 * - editExercise(jobId, exerciseIndex, content) - Edit exercise
 * - overrideVerification(jobId, exerciseIndex) - Override failure
 * - approveAll(jobId) - Bulk approve
 * - finalize(jobId) - Final approval and persist
 */
export const ConversionReviewService = {
  // This is a placeholder interface - actual implementation in handlers
  // See: src/server/payload/endpoints/conversion-jobs/
} as const

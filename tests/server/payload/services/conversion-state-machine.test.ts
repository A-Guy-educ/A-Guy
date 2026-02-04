/**
 * Unit tests for Conversion State Machine
 */
import {
  ACTIVE_STATES,
  calculateProgress,
  canCancel,
  canRetry,
  getAllowedActions,
  getStatusClass,
  getStatusLabel,
  isTerminal,
  isValidTransition,
  REVIEW_GATE_STAGES,
  shouldPauseForReview,
  TERMINAL_STATES,
  VALID_TRANSITIONS,
} from '@/server/payload/services/conversion-state-machine'
import { describe, expect, it } from 'vitest'

describe('Conversion State Machine', () => {
  describe('VALID_TRANSITIONS', () => {
    it('should define transitions from draft', () => {
      expect(VALID_TRANSITIONS.draft).toContain('queued')
      expect(VALID_TRANSITIONS.draft).not.toContain('running')
    })

    it('should define transitions from queued', () => {
      expect(VALID_TRANSITIONS.queued).toContain('running')
      expect(VALID_TRANSITIONS.queued).toContain('cancelled')
    })

    it('should define transitions from running', () => {
      expect(VALID_TRANSITIONS.running).toContain('paused')
      expect(VALID_TRANSITIONS.running).toContain('review')
      expect(VALID_TRANSITIONS.running).toContain('completed')
      expect(VALID_TRANSITIONS.running).toContain('failed')
      expect(VALID_TRANSITIONS.running).toContain('cancelled')
    })

    it('should define transitions from paused', () => {
      expect(VALID_TRANSITIONS.paused).toContain('running')
      expect(VALID_TRANSITIONS.paused).toContain('cancelled')
    })

    it('should define transitions from review', () => {
      expect(VALID_TRANSITIONS.review).toContain('running')
      expect(VALID_TRANSITIONS.review).toContain('completed')
      expect(VALID_TRANSITIONS.review).toContain('cancelled')
    })

    it('should have no transitions from terminal states', () => {
      expect(VALID_TRANSITIONS.completed).toEqual([])
      expect(VALID_TRANSITIONS.cancelled).toEqual([])
    })

    it('should allow retry from failed', () => {
      expect(VALID_TRANSITIONS.failed).toContain('queued')
    })
  })

  describe('isValidTransition', () => {
    it('should return true for valid transitions', () => {
      expect(isValidTransition('draft', 'queued')).toBe(true)
      expect(isValidTransition('queued', 'running')).toBe(true)
      expect(isValidTransition('running', 'review')).toBe(true)
      expect(isValidTransition('paused', 'running')).toBe(true)
    })

    it('should return false for invalid transitions', () => {
      expect(isValidTransition('draft', 'running')).toBe(false)
      expect(isValidTransition('completed', 'running')).toBe(false)
      expect(isValidTransition('cancelled', 'queued')).toBe(false)
    })

    it('should handle unknown states gracefully', () => {
      expect(isValidTransition('unknown' as any, 'running')).toBe(false)
      expect(isValidTransition('running', 'unknown' as any)).toBe(false)
    })
  })

  describe('shouldPauseForReview', () => {
    it('should return false for non-running status', () => {
      expect(shouldPauseForReview('draft', 'segment')).toBe(false)
      expect(shouldPauseForReview('queued', 'segment')).toBe(false)
      expect(shouldPauseForReview('completed', 'segment')).toBe(false)
    })

    it('should pause for segment mode', () => {
      expect(shouldPauseForReview('running', 'segment')).toBe(true)
      expect(shouldPauseForReview('running', 'segment', { pauseAfterSegment: false })).toBe(false)
    })

    it('should not pause for batch mode', () => {
      expect(shouldPauseForReview('running', 'batch')).toBe(false)
    })

    it('should pause for manual mode', () => {
      expect(shouldPauseForReview('running', 'manual')).toBe(true)
    })

    it('should not pause for auto mode', () => {
      expect(shouldPauseForReview('running', 'auto')).toBe(false)
    })
  })

  describe('getStatusLabel', () => {
    it('should return human-readable labels', () => {
      expect(getStatusLabel('draft')).toBe('Draft')
      expect(getStatusLabel('queued')).toBe('Queued')
      expect(getStatusLabel('running')).toBe('Running')
      expect(getStatusLabel('paused')).toBe('Paused')
      expect(getStatusLabel('review')).toBe('In Review')
      expect(getStatusLabel('completed')).toBe('Completed')
      expect(getStatusLabel('failed')).toBe('Failed')
      expect(getStatusLabel('cancelled')).toBe('Cancelled')
    })
  })

  describe('getStatusClass', () => {
    it('should return CSS class names', () => {
      expect(getStatusClass('draft')).toBe('status-draft')
      expect(getStatusClass('queued')).toBe('status-queued')
      expect(getStatusClass('running')).toBe('status-running')
      expect(getStatusClass('paused')).toBe('status-paused')
      expect(getStatusClass('review')).toBe('status-review')
      expect(getStatusClass('completed')).toBe('status-completed')
      expect(getStatusClass('failed')).toBe('status-failed')
      expect(getStatusClass('cancelled')).toBe('status-cancelled')
    })
  })

  describe('calculateProgress', () => {
    it('should return 0 for draft', () => {
      expect(
        calculateProgress('draft', {
          totalSegments: 5,
          completedSegments: 0,
          totalExercises: 20,
          approvedExercises: 0,
        }),
      ).toBe(0)
    })

    it('should return 100 for completed', () => {
      expect(
        calculateProgress('completed', {
          totalSegments: 5,
          completedSegments: 5,
          totalExercises: 20,
          approvedExercises: 20,
        }),
      ).toBe(100)
    })

    it('should calculate weighted progress', () => {
      const progress = calculateProgress('running', {
        totalSegments: 4,
        completedSegments: 2,
        totalExercises: 20,
        approvedExercises: 5,
      })
      expect(progress).toBe(42)
    })

    it('should cap at 99 for non-completed', () => {
      const progress = calculateProgress('running', {
        totalSegments: 4,
        completedSegments: 4,
        totalExercises: 20,
        approvedExercises: 20,
      })
      expect(progress).toBe(99)
    })
  })

  describe('canRetry', () => {
    it('should return true only for failed', () => {
      expect(canRetry('failed')).toBe(true)
      expect(canRetry('draft')).toBe(false)
      expect(canRetry('completed')).toBe(false)
      expect(canRetry('cancelled')).toBe(false)
    })
  })

  describe('canCancel', () => {
    it('should return false for terminal states', () => {
      expect(canCancel('completed')).toBe(false)
      expect(canCancel('cancelled')).toBe(false)
    })

    it('should return true for non-terminal states', () => {
      expect(canCancel('draft')).toBe(true)
      expect(canCancel('queued')).toBe(true)
      expect(canCancel('running')).toBe(true)
      expect(canCancel('paused')).toBe(true)
      expect(canCancel('review')).toBe(true)
      expect(canCancel('failed')).toBe(true)
    })
  })

  describe('isTerminal', () => {
    it('should return true for completed and cancelled', () => {
      expect(isTerminal('completed')).toBe(true)
      expect(isTerminal('cancelled')).toBe(true)
    })

    it('should return false for non-terminal states', () => {
      expect(isTerminal('draft')).toBe(false)
      expect(isTerminal('running')).toBe(false)
      expect(isTerminal('failed')).toBe(false)
    })
  })

  describe('getAllowedActions', () => {
    it('should return correct actions for draft', () => {
      expect(getAllowedActions('draft')).toEqual(['start'])
    })

    it('should return correct actions for queued', () => {
      expect(getAllowedActions('queued')).toEqual(['cancel'])
    })

    it('should return correct actions for running', () => {
      expect(getAllowedActions('running')).toEqual(['pause', 'cancel'])
    })

    it('should return correct actions for paused', () => {
      expect(getAllowedActions('paused')).toEqual(['resume', 'cancel'])
    })

    it('should return correct actions for review', () => {
      expect(getAllowedActions('review')).toEqual(['approve', 'skip', 'cancel'])
    })

    it('should return empty array for terminal states', () => {
      expect(getAllowedActions('completed')).toEqual([])
      expect(getAllowedActions('cancelled')).toEqual([])
    })

    it('should return retry for failed', () => {
      expect(getAllowedActions('failed')).toEqual(['retry'])
    })
  })

  describe('Constants', () => {
    it('should have correct terminal states', () => {
      expect(TERMINAL_STATES).toEqual(['completed', 'cancelled'])
    })

    it('should have correct active states', () => {
      expect(ACTIVE_STATES).toEqual(['running', 'review'])
    })

    it('should have correct review gate stages', () => {
      expect(REVIEW_GATE_STAGES).toEqual(['review'])
    })
  })
})

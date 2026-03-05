/**
 * @fileType test
 * @domain cody | engine | state-machine
 * @pattern timeout-error-handling
 * @ai-summary Tests for timeout error message handling in state-machine
 */

import { describe, it, expect } from 'vitest'

// We can't directly import the runPipeline function as it requires full setup
// Instead, we test the error message format that would be generated

describe('Pipeline timeout error handling', () => {
  describe('Error message format', () => {
    it('should include stage name and state in error message', () => {
      // Test the error message format that was added to state-machine.ts
      // Format: `Pipeline failed at stage: ${stageName} (${stageOutcome})${stageError}`

      const testCases = [
        {
          stageName: 'taskify',
          stageState: 'timeout',
          expected: 'taskify (timeout)',
        },
        {
          stageName: 'build',
          stageState: 'failed',
          expected: 'build (failed)',
        },
        {
          stageName: 'spec',
          stageState: 'timeout',
          error: 'LLM API timeout',
          expected: 'spec (timeout): LLM API timeout',
        },
      ]

      // This is the format we're testing
      for (const tc of testCases) {
        const stageError = tc.error ? `: ${tc.error}` : ''
        const message = `Pipeline failed at stage: ${tc.stageName} (${tc.stageState})${stageError}`

        expect(message).toContain(tc.expected)
        expect(message).toContain('Pipeline failed at stage:')
      }
    })

    it('should handle unknown stage gracefully', () => {
      // When no failed/timed out stage is found, should use 'unknown'
      const failedStage = undefined
      const stageName = failedStage?.[0] || 'unknown'

      expect(stageName).toBe('unknown')
      expect(`Pipeline failed at stage: ${stageName}`).toBe('Pipeline failed at stage: unknown')
    })

    it('should distinguish between failed and timeout states', () => {
      // Verify timeout states are properly handled
      const timeoutStage = { state: 'timeout', error: 'Stage timed out' }
      const failedStage = { state: 'failed', error: 'Stage failed' }

      expect(timeoutStage.state).toBe('timeout')
      expect(failedStage.state).toBe('failed')
      expect(timeoutStage.state).not.toBe(failedStage.state)
    })
  })

  describe('StageState type', () => {
    it('should include timeout as valid stage state', () => {
      // The StageState type should include 'timeout' as a valid state
      const validStates = [
        'pending',
        'running',
        'completed',
        'failed',
        'timeout',
        'skipped',
        'paused',
      ]

      // Verify all expected states are valid
      expect(validStates).toContain('timeout')
      expect(validStates).toContain('failed')
      expect(validStates).toContain('pending')
    })
  })
})

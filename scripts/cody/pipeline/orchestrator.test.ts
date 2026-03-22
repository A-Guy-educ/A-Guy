/**
 * @fileType test
 * @domain cody | pipeline | orchestrator
 * @pattern unit-test
 * @ai-summary Unit tests for PipelineOrchestrator
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PipelineOrchestrator } from './orchestrator'

describe('PipelineOrchestrator', () => {
  let orchestrator: PipelineOrchestrator

  beforeEach(() => {
    orchestrator = new PipelineOrchestrator()
  })

  describe('classifyError', () => {
    it('should classify timeout errors as technical', () => {
      const error = new Error('Request timeout after 30000ms')
      const context = {
        taskId: 'test-task',
        taskDir: '/tasks/test-task',
        stageName: 'build' as const,
        attempt: 1,
        maxAttempts: 3,
        error,
        previousErrors: [],
        startTime: Date.now(),
      }

      const result = orchestrator.classifyError(error, context)

      expect(result.category).toBe('technical')
      expect(result.retryable).toBe(true)
      expect(result.shouldEscalate).toBe(false)
    })

    it('should classify network errors as technical', () => {
      const error = new Error('ECONNREFUSED: Connection refused')
      const context = {
        taskId: 'test-task',
        taskDir: '/tasks/test-task',
        stageName: 'build' as const,
        attempt: 1,
        maxAttempts: 3,
        error,
        previousErrors: [],
        startTime: Date.now(),
      }

      const result = orchestrator.classifyError(error, context)

      expect(result.category).toBe('technical')
      expect(result.retryable).toBe(true)
    })

    it('should classify TypeScript errors as validation', () => {
      const error = new Error(
        'TS2345: Argument of type "string" is not assignable to parameter of type "number"',
      )
      const context = {
        taskId: 'test-task',
        taskDir: '/tasks/test-task',
        stageName: 'build' as const,
        attempt: 1,
        maxAttempts: 3,
        error,
        previousErrors: [],
        startTime: Date.now(),
      }

      const result = orchestrator.classifyError(error, context)

      expect(result.category).toBe('validation')
      expect(result.retryable).toBe(true)
    })

    it('should classify test failures as validation', () => {
      const error = new Error('FAIL tests/unit/foo.test.ts > should work as expected')
      const context = {
        taskId: 'test-task',
        taskDir: '/tasks/test-task',
        stageName: 'test' as const,
        attempt: 1,
        maxAttempts: 3,
        error,
        previousErrors: [],
        startTime: Date.now(),
      }

      const result = orchestrator.classifyError(error, context)

      expect(result.category).toBe('validation')
      expect(result.retryable).toBe(true)
    })

    it('should classify JSON parse errors as data quality', () => {
      const error = new Error('SyntaxError: Unexpected token in JSON at position 0')
      const context = {
        taskId: 'test-task',
        taskDir: '/tasks/test-task',
        stageName: 'architect' as const,
        attempt: 1,
        maxAttempts: 3,
        error,
        previousErrors: [],
        startTime: Date.now(),
      }

      const result = orchestrator.classifyError(error, context)

      expect(result.category).toBe('data_quality')
      expect(result.retryable).toBe(false)
      expect(result.shouldEscalate).toBe(true)
    })

    it('should classify unknown errors with unknown category', () => {
      const error = new Error('Something went wrong but not sure what')
      const context = {
        taskId: 'test-task',
        taskDir: '/tasks/test-task',
        stageName: 'build' as const,
        attempt: 1,
        maxAttempts: 3,
        error,
        previousErrors: [],
        startTime: Date.now(),
      }

      const result = orchestrator.classifyError(error, context)

      expect(result.category).toBe('unknown')
      expect(result.shouldEscalate).toBe(true)
    })
  })

  describe('decide', () => {
    it('should return halt for data quality errors', () => {
      const context = {
        taskId: 'test-task',
        taskDir: '/tasks/test-task',
        stageName: 'architect' as const,
        attempt: 1,
        maxAttempts: 3,
        error: new Error('Invalid JSON'),
        previousErrors: [],
        startTime: Date.now(),
      }

      const classification = {
        category: 'data_quality' as const,
        reason: 'Invalid JSON',
        retryable: false,
        shouldEscalate: true,
      }

      const decision = orchestrator.decide(context, classification)

      expect(decision.action).toBe('halt')
    })

    it('should return retry for technical errors on first attempt', () => {
      const context = {
        taskId: 'test-task',
        taskDir: '/tasks/test-task',
        stageName: 'build' as const,
        attempt: 1,
        maxAttempts: 3,
        error: new Error('Connection reset'),
        previousErrors: [],
        startTime: Date.now(),
      }

      const classification = {
        category: 'technical' as const,
        reason: 'Network error',
        retryable: true,
        shouldEscalate: false,
      }

      const decision = orchestrator.decide(context, classification)

      expect(decision.action).toBe('retry')
      if (decision.action === 'retry') {
        expect(decision.delayMs).toBeDefined()
      }
    })

    it('should escalate validation errors after 2 attempts', () => {
      const context = {
        taskId: 'test-task',
        taskDir: '/tasks/test-task',
        stageName: 'build' as const,
        attempt: 2,
        maxAttempts: 3,
        error: new Error('TypeScript error'),
        previousErrors: [],
        startTime: Date.now(),
      }

      const classification = {
        category: 'validation' as const,
        reason: 'TypeScript error',
        retryable: true,
        shouldEscalate: true,
      }

      const decision = orchestrator.decide(context, classification)

      expect(decision.action).toBe('escalate')
    })
  })

  describe('getRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      // First attempt: 1000ms base delay
      expect(orchestrator.getRetryDelay(1)).toBe(1000)

      // Second attempt: 1000 * 2 = 2000ms
      expect(orchestrator.getRetryDelay(2)).toBe(2000)

      // Third attempt: 1000 * 4 = 4000ms
      expect(orchestrator.getRetryDelay(3)).toBe(4000)
    })

    it('should cap delay at maxDelayMs', () => {
      // Even with high attempt, delay should be capped
      const cappedOrchestrator = new PipelineOrchestrator({
        maxDelayMs: 5000,
      })

      expect(cappedOrchestrator.getRetryDelay(10)).toBe(5000)
    })
  })

  describe('getStats', () => {
    it('should return empty stats initially', () => {
      const stats = orchestrator.getStats()

      expect(stats.totalDecisions).toBe(0)
      expect(stats.decisionsByAction).toEqual({})
      expect(stats.stageStats).toEqual({})
    })
  })

  describe('reset', () => {
    it('should clear error and decision history', () => {
      // Add some data
      const context = {
        taskId: 'test-task',
        taskDir: '/tasks/test-task',
        stageName: 'build' as const,
        attempt: 1,
        maxAttempts: 3,
        error: new Error('Test error'),
        previousErrors: [],
        startTime: Date.now(),
      }

      const classification = {
        category: 'technical' as const,
        reason: 'Test',
        retryable: true,
        shouldEscalate: false,
      }

      orchestrator.decide(context, classification)

      // Reset
      orchestrator.reset()

      const stats = orchestrator.getStats()
      expect(stats.totalDecisions).toBe(0)
    })
  })
})

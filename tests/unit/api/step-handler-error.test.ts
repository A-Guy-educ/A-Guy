/**
 * Step Handler Error Unit Tests
 *
 * Tests the StepHandlerError class for proper error handling
 * in the interactive demo step endpoint.
 *
 * @fileType unit-test
 * @domain api.interactive-demo
 * @pattern error-handling
 */

import { StepHandlerError } from '@/server/payload/endpoints/interactive-demo/step-handler'
import { describe, expect, test } from 'vitest'

describe('StepHandlerError', () => {
  test('creates error with correct properties', () => {
    const error = new StepHandlerError('VALIDATION_ERROR', 'Test validation error', 400)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('StepHandlerError')
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.message).toBe('Test validation error')
    expect(error.status).toBe(400)
  })

  test('creates error for different status codes', () => {
    const testCases = [
      { code: 'LESSON_NOT_FOUND', message: 'Lesson not found', status: 404 },
      { code: 'UNAUTHORIZED', message: 'Not authorized', status: 401 },
      { code: 'FEATURE_DISABLED', message: 'Feature disabled', status: 403 },
      { code: 'INTERNAL_ERROR', message: 'Internal error', status: 500 },
    ] as const

    testCases.forEach(({ code, message, status }) => {
      const error = new StepHandlerError(code, message, status)
      expect(error.code).toBe(code)
      expect(error.message).toBe(message)
      expect(error.status).toBe(status)
    })
  })

  test('is throwable', () => {
    expect(() => {
      throw new StepHandlerError('VALIDATION_ERROR', 'Test error', 400)
    }).toThrow(StepHandlerError)
  })

  test('can be caught with instanceof', () => {
    try {
      throw new StepHandlerError('SESSION_NOT_FOUND', 'Session not found', 404)
    } catch (error) {
      expect(error).toBeInstanceOf(StepHandlerError)
      if (error instanceof StepHandlerError) {
        expect(error.code).toBe('SESSION_NOT_FOUND')
        expect(error.status).toBe(404)
      }
    }
  })

  test('has stack trace', () => {
    const error = new StepHandlerError('VALIDATION_ERROR', 'Test error', 400)
    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('StepHandlerError')
  })
})

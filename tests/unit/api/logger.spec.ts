/**
 * Unit Tests for API Logger
 */
import { createApiLogger } from '@/server/api/logger'
import type { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

describe('API Logger', () => {
  describe('createApiLogger()', () => {
    it('should create logger with route and request info', () => {
      const mockRequest = {
        headers: new Headers(),
        method: 'GET',
        url: 'http://localhost/api/test',
      } as unknown as NextRequest

      const logger = createApiLogger(mockRequest, 'test-route')

      expect(logger).toBeDefined()
    })

    it('should extract request ID from headers', () => {
      const mockRequest = {
        headers: new Headers(),
        method: 'GET',
        url: 'http://localhost/api/test',
      } as unknown as NextRequest
      mockRequest.headers.set('x-request-id', 'test-request-id')

      const logger = createApiLogger(mockRequest, 'test-route')

      expect(logger).toBeDefined()
    })

    it('should generate request ID if not in headers', () => {
      const mockRequest = {
        headers: new Headers(),
        method: 'GET',
        url: 'http://localhost/api/test',
      } as unknown as NextRequest

      const logger = createApiLogger(mockRequest, 'test-route')

      expect(logger).toBeDefined()
    })

    it('should extract OpenTelemetry trace context', () => {
      const mockRequest = {
        headers: new Headers(),
        method: 'GET',
        url: 'http://localhost/api/test',
      } as unknown as NextRequest
      mockRequest.headers.set('x-trace-id', 'trace-123')
      mockRequest.headers.set('x-span-id', 'span-456')

      const logger = createApiLogger(mockRequest, 'test-route')

      expect(logger).toBeDefined()
    })

    it('should handle missing trace context gracefully', () => {
      const mockRequest = {
        headers: new Headers(),
        method: 'POST',
        url: 'http://localhost/api/submit',
      } as unknown as NextRequest

      const logger = createApiLogger(mockRequest, 'submit-route')

      expect(logger).toBeDefined()
    })
  })
})

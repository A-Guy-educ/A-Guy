import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  prFilesQuerySchema,
  prsQuerySchema,
  taskIdSchema,
  pipelineParamsSchema,
  workflowsQuerySchema,
} from '@/lib/cody/schemas'
import { ApiErrors } from '@/server/api/responses'
import { handleCodyApiError } from '@/lib/cody/github-error-handler'
import { ZodError } from 'zod'

describe('Cody API Schemas', () => {
  describe('taskIdSchema', () => {
    it('accepts valid taskId format (YYMMDD-description)', () => {
      const result = taskIdSchema.safeParse('260221-test')
      expect(result.success).toBe(true)
    })

    it('accepts taskId with numbers and hyphens', () => {
      const result = taskIdSchema.safeParse('260301-feature-123')
      expect(result.success).toBe(true)
    })

    it('rejects invalid taskId format', () => {
      const result = taskIdSchema.safeParse('invalid')
      expect(result.success).toBe(false)
    })

    it('rejects taskId without date prefix', () => {
      const result = taskIdSchema.safeParse('just-a-string')
      expect(result.success).toBe(false)
    })
  })

  describe('prsQuerySchema', () => {
    it('accepts valid taskId', () => {
      const result = prsQuerySchema.safeParse({ taskId: '260221-test' })
      expect(result.success).toBe(true)
    })

    it('rejects missing taskId', () => {
      const result = prsQuerySchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects invalid taskId format', () => {
      const result = prsQuerySchema.safeParse({ taskId: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('rejects extra unknown keys (strict mode)', () => {
      const result = prsQuerySchema.safeParse({ taskId: '260221-test', unknownKey: 'value' })
      expect(result.success).toBe(false)
    })
  })

  describe('prFilesQuerySchema', () => {
    it('accepts valid positive integer prNumber', () => {
      const result = prFilesQuerySchema.safeParse({ prNumber: '123' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.prNumber).toBe(123)
      }
    })

    it('rejects non-numeric prNumber', () => {
      const result = prFilesQuerySchema.safeParse({ prNumber: 'abc' })
      expect(result.success).toBe(false)
    })

    it('rejects zero prNumber', () => {
      const result = prFilesQuerySchema.safeParse({ prNumber: '0' })
      expect(result.success).toBe(false)
    })

    it('rejects negative prNumber', () => {
      const result = prFilesQuerySchema.safeParse({ prNumber: '-1' })
      expect(result.success).toBe(false)
    })

    it('rejects missing prNumber', () => {
      const result = prFilesQuerySchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('workflowsQuerySchema', () => {
    it('accepts valid status value', () => {
      const result = workflowsQuerySchema.safeParse({ status: 'queued' })
      expect(result.success).toBe(true)
    })

    it('accepts all valid status values', () => {
      expect(workflowsQuerySchema.safeParse({ status: 'queued' }).success).toBe(true)
      expect(workflowsQuerySchema.safeParse({ status: 'in_progress' }).success).toBe(true)
      expect(workflowsQuerySchema.safeParse({ status: 'completed' }).success).toBe(true)
    })

    it('accepts missing status (optional)', () => {
      const result = workflowsQuerySchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('rejects invalid status value', () => {
      const result = workflowsQuerySchema.safeParse({ status: 'invalid' })
      expect(result.success).toBe(false)
    })
  })

  describe('pipelineParamsSchema', () => {
    it('accepts valid taskId', () => {
      const result = pipelineParamsSchema.safeParse({ taskId: '260221-test' })
      expect(result.success).toBe(true)
    })

    it('rejects invalid taskId format', () => {
      const result = pipelineParamsSchema.safeParse({ taskId: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('rejects missing taskId', () => {
      const result = pipelineParamsSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })
})

describe('ApiErrors extension', () => {
  describe('rateLimited', () => {
    it('returns 429 with code RATE_LIMITED', async () => {
      const response = ApiErrors.rateLimited()
      expect(response.status).toBe(429)
      const body = await response.json()
      expect(body.error.code).toBe('RATE_LIMITED')
    })

    it('includes Retry-After header when provided', () => {
      const response = ApiErrors.rateLimited('60')
      expect(response.headers.get('Retry-After')).toBe('60')
    })

    it('does not include Retry-After header when not provided', () => {
      const response = ApiErrors.rateLimited()
      expect(response.headers.get('Retry-After')).toBeNull()
    })
  })

  describe('upstreamError', () => {
    it('returns 502 with code UPSTREAM_ERROR', async () => {
      const response = ApiErrors.upstreamError()
      expect(response.status).toBe(502)
      const body = await response.json()
      expect(body.error.code).toBe('UPSTREAM_ERROR')
    })

    it('accepts custom message', async () => {
      const response = ApiErrors.upstreamError('Custom error message')
      const body = await response.json()
      expect(body.error.message).toBe('Custom error message')
    })
  })
})

describe('handleCodyApiError', () => {
  // Spy on console.error to verify logging
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('handles ZodError and returns 400 VALIDATION_ERROR', async () => {
    const zodError = new ZodError([
      { code: 'invalid_type', path: ['taskId'], message: 'Required' } as never,
    ])
    const response = handleCodyApiError(zodError, 'test-route')
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('handles 401 and returns 502 UNAUTHORIZED', async () => {
    const error = { status: 401, message: 'Unauthorized' }
    const response = handleCodyApiError(error, 'test-route')
    expect(response.status).toBe(502)
    const body = await response.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('handles 403 and returns 403 FORBIDDEN', async () => {
    const error = { status: 403, message: 'Forbidden' }
    const response = handleCodyApiError(error, 'test-route')
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('handles 403 with rate limit headers and returns 429', async () => {
    const error = {
      status: 403,
      response: {
        headers: { 'x-ratelimit-remaining': '0' },
      },
    }
    const response = handleCodyApiError(error, 'test-route')
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('handles 404 and returns 404 NOT_FOUND', async () => {
    const error = { status: 404, message: 'Not found' }
    const response = handleCodyApiError(error, 'test-route')
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('handles 429 and returns 429 RATE_LIMITED', async () => {
    const error = { status: 429 }
    const response = handleCodyApiError(error, 'test-route')
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('handles 429 with retry-after header and forwards it', () => {
    const error = {
      status: 429,
      response: {
        headers: { 'retry-after': '60' },
      },
    }
    const response = handleCodyApiError(error, 'test-route')
    expect(response.headers.get('Retry-After')).toBe('60')
  })

  it('handles 500 and returns 502 UPSTREAM_ERROR', async () => {
    const error = { status: 500, message: 'Server error' }
    const response = handleCodyApiError(error, 'test-route')
    expect(response.status).toBe(502)
    const body = await response.json()
    expect(body.error.code).toBe('UPSTREAM_ERROR')
  })

  it('handles unknown errors and returns 500 INTERNAL_ERROR', async () => {
    const error = new Error('Something went wrong')
    const response = handleCodyApiError(error, 'test-route')
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('does not leak stack traces in response body', async () => {
    const error = new Error('Sensitive error message')
    const response = handleCodyApiError(error, 'test-route')
    const body = await response.json()
    // Should not contain stack trace
    expect(body.error.message).not.toContain('at ')
    // Should contain a safe generic message
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('logs error with route name but no sensitive data', () => {
    const error = new Error('Sensitive error message')
    handleCodyApiError(error, 'test-route')

    expect(consoleSpy).toHaveBeenCalled()
    // The console.error should be called with '[Cody] test-route: ...'
    const firstCall = consoleSpy.mock.calls[0]
    expect(firstCall).toBeDefined()
    const loggedMessage = String(firstCall?.[0] || '')
    expect(loggedMessage).toContain('[Cody]')
    expect(loggedMessage).toContain('test-route')
  })
})

import { apiError, ApiErrors, apiSuccess, apiValidationError } from '@/server/api/responses'
import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'

describe('API Response Utilities', () => {
  describe('apiError()', () => {
    it('should create error response with code and message', async () => {
      const response = apiError('NOT_FOUND', 'Resource not found', 404)
      expect(response.status).toBe(404)

      const body = await response.json()
      expect(body.error.code).toBe('NOT_FOUND')
      expect(body.error.message).toBe('Resource not found')
    })

    it('should include details when provided', async () => {
      const details = { fieldA: ['Required'], fieldB: ['Invalid format'] }
      const response = apiError('VALIDATION_ERROR', 'Validation failed', 400, details)

      const body = await response.json()
      expect(body.error.details).toEqual(details)
    })
  })

  describe('apiSuccess()', () => {
    it('should create success response with data', async () => {
      const response = apiSuccess({ jobId: '123' })
      expect(response.status).toBe(200)

      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.jobId).toBe('123')
    })

    it('should include message when provided', async () => {
      const response = apiSuccess({ jobId: '123' }, 'Job queued successfully')
      const body = await response.json()
      expect(body.message).toBe('Job queued successfully')
    })

    it('should use custom status code', async () => {
      const response = apiSuccess(null, 'Created', 201)
      expect(response.status).toBe(201)
    })
  })

  describe('apiValidationError()', () => {
    it('should format ZodError into details', async () => {
      const zodError = new ZodError([
        { code: 'invalid_type', path: ['jobId'], message: 'Required' } as any,
        { code: 'invalid_string', path: ['email'], message: 'Invalid email' } as any,
      ])

      const response = apiValidationError(zodError)
      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.details.jobId).toContain('Required')
      expect(body.error.details.email).toContain('Invalid email')
    })
  })

  describe('ApiErrors shortcuts', () => {
    it('unauthorized should return 401', async () => {
      const response = ApiErrors.unauthorized('Token expired')
      expect(response.status).toBe(401)
      expect((await response.json()).error.code).toBe('UNAUTHORIZED')
    })

    it('forbidden should return 403', async () => {
      const response = ApiErrors.forbidden()
      expect(response.status).toBe(403)
      expect((await response.json()).error.code).toBe('FORBIDDEN')
    })

    it('notFound should include resource name', async () => {
      const response = ApiErrors.notFound('Job')
      expect(response.status).toBe(404)
      expect((await response.json()).error.message).toBe('Job not found')
    })

    it('internal should return 500', async () => {
      const response = ApiErrors.internal('Database error')
      expect(response.status).toBe(500)
      expect((await response.json()).error.code).toBe('INTERNAL_ERROR')
    })
  })
})

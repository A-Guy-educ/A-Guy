import {
  jobStatusQuerySchema,
  queueConversionSchema,
  runJobSchema,
} from '@/server/api/schemas/job-schemas'
import { describe, expect, it } from 'vitest'

describe('Job Schemas', () => {
  describe('runJobSchema', () => {
    it('should accept valid ObjectId', () => {
      const validId = '507f1f77bcf86cd799439011'
      const result = runJobSchema.safeParse({ jobId: validId })
      expect(result.success).toBe(true)
    })

    it('should reject invalid ObjectId format', () => {
      const result = runJobSchema.safeParse({ jobId: 'invalid-id' })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Invalid ObjectId format')
    })

    it('should reject missing jobId', () => {
      const result = runJobSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('jobStatusQuerySchema', () => {
    it('should accept valid query params', () => {
      const result = jobStatusQuerySchema.safeParse({
        lessonId: '507f1f77bcf86cd799439011',
        mediaId: '507f1f77bcf86cd799439012',
        limit: '10',
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.limit).toBe(10)
    })

    it('should use default limit', () => {
      const result = jobStatusQuerySchema.safeParse({
        lessonId: '507f1f77bcf86cd799439011',
        mediaId: '507f1f77bcf86cd799439012',
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.limit).toBe(1)
    })

    it('should reject limit below 1', () => {
      const result = jobStatusQuerySchema.safeParse({
        lessonId: '507f1f77bcf86cd799439011',
        mediaId: '507f1f77bcf86cd799439012',
        limit: '0',
      })
      expect(result.success).toBe(false)
    })

    it('should reject limit above 100', () => {
      const result = jobStatusQuerySchema.safeParse({
        lessonId: '507f1f77bcf86cd799439011',
        mediaId: '507f1f77bcf86cd799439012',
        limit: '101',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('queueConversionSchema', () => {
    it('should accept valid conversion request', () => {
      const result = queueConversionSchema.safeParse({
        lessonId: '507f1f77bcf86cd799439011',
        mediaId: '507f1f77bcf86cd799439012',
        extractorPromptId: '507f1f77bcf86cd799439013',
        verifierPromptId: '507f1f77bcf86cd799439014',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing fields', () => {
      const result = queueConversionSchema.safeParse({
        lessonId: '507f1f77bcf86cd799439011',
        mediaId: '507f1f77bcf86cd799439012',
      })
      expect(result.success).toBe(false)
    })
  })
})

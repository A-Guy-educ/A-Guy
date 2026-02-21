/**
 * Unit tests for exercise-conversion helpers
 */
import {
  buildJobsWhereQuery,
  validatePromptForUsageAndTenant,
} from '@/server/services/exercise-conversion/helpers'
import { describe, expect, it } from 'vitest'

describe('exercise-conversion helpers', () => {
  describe('buildJobsWhereQuery', () => {
    it('should build correct query for lesson and media', () => {
      const query = buildJobsWhereQuery('lesson-123', 'media-456')
      expect(query).toEqual({
        and: [
          { taskSlug: { equals: 'pdf_to_exercises' } },
          { 'input.ctx.lessonId': { equals: 'lesson-123' } },
          { 'input.ctx.sourceDocId': { equals: 'media-456' } },
        ],
      })
    })
  })

  describe('validatePromptForUsageAndTenant', () => {
    it('should pass for valid extractor prompt', () => {
      const prompt = {
        status: 'published',
        usage: 'extractor',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tenant: { id: 'tenant-123' } as any,
      }
      expect(() =>
        validatePromptForUsageAndTenant(prompt as any, 'extractor', 'tenant-123'),
      ).not.toThrow()
    })

    it('should pass for valid verifier prompt', () => {
      const prompt = {
        status: 'published',
        usage: 'verifier',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tenant: { id: 'tenant-123' } as any,
      }
      expect(() =>
        validatePromptForUsageAndTenant(prompt as any, 'verifier', 'tenant-123'),
      ).not.toThrow()
    })

    it('should throw for draft prompt', () => {
      const prompt = {
        status: 'draft',
        usage: 'extractor',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tenant: { id: 'tenant-123' } as any,
      }
      expect(() =>
        validatePromptForUsageAndTenant(prompt as any, 'extractor', 'tenant-123'),
      ).toThrow('Prompt is not published')
    })

    it('should throw for wrong usage type', () => {
      const prompt = {
        status: 'published',
        usage: 'extractor',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tenant: { id: 'tenant-123' } as any,
      }
      expect(() =>
        validatePromptForUsageAndTenant(prompt as any, 'verifier', 'tenant-123'),
      ).toThrow('Prompt usage is extractor')
    })

    it('should throw for wrong tenant', () => {
      const prompt = {
        status: 'published',
        usage: 'extractor',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tenant: { id: 'other-tenant' } as any,
      }
      expect(() =>
        validatePromptForUsageAndTenant(prompt as any, 'extractor', 'tenant-123'),
      ).toThrow('Prompt tenant mismatch')
    })
  })
})

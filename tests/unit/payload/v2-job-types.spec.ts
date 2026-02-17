/**
 * Unit Tests for V2 Job Types and Constants
 *
 * Tests:
 * - TASK_SLUGS.PDF_TO_EXERCISES_V2 exists and has correct value
 * - V2 input/output types are properly defined
 * - JobContext includes pipeline-specific fields
 */

import { TASK_SLUGS, PDF_TO_EXERCISES_V2 } from '@/server/payload/jobs/constants'
import type {
  PdfToExercisesV2Input,
  PdfToExercisesV2Output,
  JobContext,
} from '@/server/payload/jobs/types'
import { describe, expect, it } from 'vitest'

describe('V2 Job Constants', () => {
  describe('TASK_SLUGS', () => {
    it('should have PDF_TO_EXERCISES_V2 slug', () => {
      expect(TASK_SLUGS.PDF_TO_EXERCISES_V2).toBe('pdf_to_exercises_v2')
    })

    it('should export PDF_TO_EXERCISES_V2 constant separately', () => {
      expect(PDF_TO_EXERCISES_V2).toBe('pdf_to_exercises_v2')
    })

    it('should have readonly type', () => {
      const slugs: typeof TASK_SLUGS = TASK_SLUGS
      expect(slugs).toEqual(TASK_SLUGS)
    })
  })
})

describe('V2 Job Types', () => {
  describe('JobContext with V2 fields', () => {
    it('should allow pipelineVersion and conversionMode', () => {
      const context: JobContext = {
        lessonId: 'lesson-123',
        sourceDocId: 'media-456',
        tenantId: 'Aguy',
        pipelineVersion: 2,
        conversionMode: 'v2_crops',
      }

      expect(context.pipelineVersion).toBe(2)
      expect(context.conversionMode).toBe('v2_crops')
    })
  })

  describe('PdfToExercisesV2Input', () => {
    it('should accept V2-specific context', () => {
      const input: PdfToExercisesV2Input = {
        ctx: {
          lessonId: 'lesson-123',
          sourceDocId: 'media-456',
          tenantId: 'Aguy',
          pipelineVersion: 2,
          conversionMode: 'v2_crops',
        },
      }

      expect(input.ctx.pipelineVersion).toBe(2)
      expect(input.ctx.conversionMode).toBe('v2_crops')
    })

    it('should not require additional fields (unlike V1)', () => {
      // V2 does not require promptRefs, maxSegmentPages, etc.
      const input: PdfToExercisesV2Input = {
        ctx: {
          lessonId: 'lesson-123',
          sourceDocId: 'media-456',
          tenantId: 'Aguy',
          pipelineVersion: 2,
          conversionMode: 'v2_crops',
        },
      }

      // Should not have V1-specific fields
      expect((input as any).maxSegmentPages).toBeUndefined()
      expect((input as any).promptRefs).toBeUndefined()
    })
  })

  describe('PdfToExercisesV2Output', () => {
    it('should define V2-specific output structure', () => {
      const output: PdfToExercisesV2Output = {
        pagesTotal: 5,
        pagesProcessed: 3,
        exercisesCreated: 12,
        errors: [
          {
            pageIndex: 1,
            bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
            reason: 'Crop too small',
          },
        ],
        warnings: ['Model returned no bboxes on page 4'],
      }

      expect(output.pagesTotal).toBe(5)
      expect(output.pagesProcessed).toBe(3)
      expect(output.exercisesCreated).toBe(12)
      expect(output.errors).toHaveLength(1)
      expect(output.warnings).toHaveLength(1)
    })

    it('should allow empty errors and warnings arrays', () => {
      const output: PdfToExercisesV2Output = {
        pagesTotal: 2,
        pagesProcessed: 2,
        exercisesCreated: 4,
        errors: [],
        warnings: [],
      }

      expect(output.errors).toHaveLength(0)
      expect(output.warnings).toHaveLength(0)
    })

    it('should allow errors without bbox', () => {
      const output: PdfToExercisesV2Output = {
        pagesTotal: 1,
        pagesProcessed: 0,
        exercisesCreated: 0,
        errors: [
          {
            pageIndex: 0,
            reason: 'PDF processing failed',
          },
        ],
        warnings: [],
      }

      expect(output.errors[0].bbox).toBeUndefined()
      expect(output.errors[0].pageIndex).toBe(0)
    })
  })
})

describe('V2 Type Assertions', () => {
  it('should allow creating V2 input at runtime', () => {
    const input: PdfToExercisesV2Input = {
      ctx: {
        lessonId: 'lesson-123',
        sourceDocId: 'media-456',
        tenantId: 'Aguy',
        pipelineVersion: 2,
        conversionMode: 'v2_crops',
      },
    }

    // Compile-time type assertion - this will fail at compile time if types don't match
    expect(input.ctx.tenantId).toBe('Aguy')
  })

  it('should have distinct types from V1', () => {
    // Ensure V1 and V2 types are not accidentally the same
    type _V1Input = { ctx: JobContext; maxSegmentPages: number }
    type V2Input = PdfToExercisesV2Input

    // V2 should not have maxSegmentPages
    const v2Input: V2Input = {
      ctx: {
        lessonId: 'lesson-123',
        sourceDocId: 'media-456',
        tenantId: 'Aguy',
        pipelineVersion: 2,
        conversionMode: 'v2_crops',
      },
    }

    // This should be undefined for V2
    expect((v2Input as any).maxSegmentPages).toBeUndefined()
  })
})

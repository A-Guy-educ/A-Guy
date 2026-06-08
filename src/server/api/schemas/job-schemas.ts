/**
 * Zod schemas for job-queue API endpoints (run, status, queue)
 *
 * @fileType schema
 * @domain api
 * @ai-summary Shared input validation for job management endpoints — ObjectId regex is stricter than Payload's default (accepts only 24-char hex), so copy-pasting this schema to new endpoints without adjustment would silently reject valid IDs from other collections.
 */
import { z } from 'zod'

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format')

export const runJobSchema = z.object({
  jobId: objectIdSchema,
})

export const jobStatusQuerySchema = z.object({
  lessonId: objectIdSchema.optional(),
  mediaId: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  pipelineVersion: z.coerce.number().int().min(1).max(2).optional(),
})

export const queueConversionSchema = z.object({
  lessonId: objectIdSchema,
  mediaId: objectIdSchema,
  extractorPromptId: objectIdSchema,
  verifierPromptId: objectIdSchema,
  diagramPromptId: objectIdSchema.optional(),
})

export type RunJobInput = z.infer<typeof runJobSchema>
export type JobStatusQuery = z.infer<typeof jobStatusQuerySchema>
export type QueueConversionInput = z.infer<typeof queueConversionSchema>

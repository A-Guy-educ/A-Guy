import { z } from 'zod'

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format')

export const runJobSchema = z.object({
  jobId: objectIdSchema,
})

export const jobStatusQuerySchema = z.object({
  lessonId: objectIdSchema.optional(),
  mediaId: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
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

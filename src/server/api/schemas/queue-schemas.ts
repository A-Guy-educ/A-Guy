import { z } from 'zod'

/** Zod schema for V1 queue request validation */
export const queueRequestSchema = z.object({
  lessonId: z.string().min(1),
  mediaId: z.string().min(1),
  extractorPromptId: z.string().min(1),
  verifierPromptId: z.string().min(1),
})

export type QueueRequest = z.infer<typeof queueRequestSchema>

/** Zod schema for V2 queue request validation */
export const queueV2RequestSchema = z.object({
  lessonId: z.string().min(1),
  mediaId: z.string().min(1),
})

export type QueueV2Request = z.infer<typeof queueV2RequestSchema>

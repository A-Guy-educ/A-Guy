/**
 * Queue V1 Request Schema
 *
 * Zod schema for request validation of the V1 queue endpoint.
 *
 * @fileType utility
 * @domain conversion
 * @pattern validation, zod-schema
 */

import { z } from 'zod'

export const queueRequestSchema = z.object({
  lessonId: z.string().min(1),
  mediaId: z.string().min(1),
  extractorPromptId: z.string().min(1),
  verifierPromptId: z.string().min(1),
})

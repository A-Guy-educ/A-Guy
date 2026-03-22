/**
 * Queue V2 Request Schema
 *
 * Zod schema for request validation of the V2 queue endpoint.
 *
 * @fileType utility
 * @domain conversion
 * @pattern validation, zod-schema
 */

import { z } from 'zod'

export const queueV2RequestSchema = z.object({
  lessonId: z.string().min(1),
  mediaId: z.string().min(1),
})

import { z } from 'zod'
import { BlockIdSchema } from '../primitives'

/**
 * Exercise Content Schema - Strict Flat Blocks (No Backward Compatibility)
 *
 * ONLY valid structure:
 *   content: { blocks: RichTextBlock[] }
 *
 * Any other structure is INVALID and will be rejected.
 */

/** Rich text block - the only supported block type */
export const RichTextBlockSchema = z
  .object({
    id: BlockIdSchema,
    type: z.literal('rich_text'),
    format: z.literal('md-math-v1'),
    value: z.string().min(1),
    mediaIds: z.array(z.string()).default([]),
  })
  .strict()

export type RichTextBlock = z.infer<typeof RichTextBlockSchema>

/**
 * Exercise Content - Strict Schema
 * REQUIRES: { blocks: RichTextBlock[] } with at least one block
 */
export const ExerciseContentSchema = z
  .object({
    blocks: z.array(RichTextBlockSchema).min(1, 'At least one block is required'),
  })
  .strict()

export type ExerciseContent = z.infer<typeof ExerciseContentSchema>

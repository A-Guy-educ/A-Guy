import { z } from 'zod'
import { BlockV1Schema } from './blocks'

/**
 * Exercise Content Schema v1
 *
 * Represents the complete content of an exercise.
 * - contentSchemaVersion: 1 (always)
 * - stem: Array of BlockV1
 *
 * Note: Legacy "sections" are removed. Sections are now just blocks of type "section" within the stem.
 */

export const ExerciseContentSchema = z
  .object({
    contentSchemaVersion: z.literal(1).default(1),
    stem: z.array(BlockV1Schema),
  })
  .strict()

export type ExerciseContent = z.infer<typeof ExerciseContentSchema>

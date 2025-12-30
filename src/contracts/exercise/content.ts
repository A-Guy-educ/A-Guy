import { z } from 'zod'
import { ExerciseBlockSchema } from './blocks'

/**
 * Exercise content structure
 * Represents the complete content of an exercise with stem and optional sections
 */

/** Section schema (recursive for subsections) */
export const SectionSchema: z.ZodType<{
  id: string
  label?: string
  prompt: z.infer<typeof ExerciseBlockSchema>[]
  subSections?: {
    id: string
    label?: string
    prompt: z.infer<typeof ExerciseBlockSchema>[]
    subSections?: unknown[]
  }[]
}> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      label: z.string().optional(), // e.g., "A", "1", "a"
      prompt: z.array(ExerciseBlockSchema), // The section question/prompt
      subSections: z.array(SectionSchema).optional(), // Allow nesting
    })
    .strict(),
)

/** Exercise content schema */
export const ExerciseContentSchema = z
  .object({
    stem: z.array(ExerciseBlockSchema),
    sections: z.array(SectionSchema).optional(),
  })
  .strict()

/** Inferred TypeScript types */
export type Section = z.infer<typeof SectionSchema>
export type ExerciseContent = z.infer<typeof ExerciseContentSchema>

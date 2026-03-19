/**
 * Zod schema for generate-support request validation
 */
import { z } from 'zod'

export const GenerateSupportSchema = z.object({
  scope: z.enum(['section', 'exercise', 'lesson']),
  id: z.string().min(1),
  blockId: z.string().optional(),
  options: z
    .object({
      overwrite: z.boolean().default(false),
      targetFields: z
        .array(z.enum(['hints', 'solution', 'fullSolution']))
        .default(['hints', 'solution', 'fullSolution']),
    })
    .default({
      overwrite: false,
      targetFields: ['hints', 'solution', 'fullSolution'],
    }),
})

export type ParsedSupportInput = z.infer<typeof GenerateSupportSchema>

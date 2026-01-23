import { z } from 'zod'

/**
 * Shared interaction specification for Drawing Response
 * Used by both AxisSpecV1 and GeometrySpecV1
 */

/** Tool types available for interaction */
export const InteractionToolSchema = z.enum(['point', 'line', 'shade', 'move', 'erase'])

/** Evaluation mode */
export const EvaluationModeSchema = z.enum(['none', 'manual', 'rules'])

/** Base interaction specification schema */
export const InteractionSpecBaseSchema = z
  .object({
    enabled: z.boolean(),
    toolsAllowed: z.array(InteractionToolSchema),
    evaluation: z
      .object({
        mode: EvaluationModeSchema,
        rules: z.array(z.unknown()).optional(), // Placeholder for future grading rules
      })
      .optional(),
  })
  .strict()
  .optional()

/** Inferred types */
export type InteractionTool = z.infer<typeof InteractionToolSchema>
export type EvaluationMode = z.infer<typeof EvaluationModeSchema>
export type InteractionSpecBase = z.infer<typeof InteractionSpecBaseSchema>

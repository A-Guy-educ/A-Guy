import { z } from 'zod'
import { ExerciseBlockSchema } from './blocks'

/**
 * Answer specifications - Discriminated union by 'questionType'
 * Version 1 question types: mcq, true_false, free_response
 */

/** MCQ (Multiple Choice Question) Answer Spec */
const McqAnswerSpecSchema = z
  .object({
    questionType: z.literal('mcq'),
    multiSelect: z.boolean(),
    options: z
      .array(
        z
          .object({
            id: z.string(),
            content: z.array(ExerciseBlockSchema),
          })
          .strict(),
      )
      .min(1),
    correctOptionIds: z.array(z.string()).min(1),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Extract option IDs
    const optionIds = new Set(data.options.map((opt) => opt.id))

    // Validate correctOptionIds are subset of option IDs
    for (const correctId of data.correctOptionIds) {
      if (!optionIds.has(correctId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correctOptionId "${correctId}" does not exist in options`,
          path: ['correctOptionIds'],
        })
      }
    }

    // If single-select, must have exactly one correct option
    if (!data.multiSelect && data.correctOptionIds.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Single-select MCQ must have exactly 1 correct option, got ${data.correctOptionIds.length}`,
        path: ['correctOptionIds'],
      })
    }
  })

/** True/False Answer Spec */
const TrueFalseAnswerSpecSchema = z
  .object({
    questionType: z.literal('true_false'),
    correct: z.boolean(),
  })
  .strict()

/** Free Response - Numeric */
const FreeResponseNumericSchema = z
  .object({
    questionType: z.literal('free_response'),
    responseKind: z.literal('numeric'),
    acceptedAnswers: z.array(z.string()).min(1),
    tolerance: z.number().optional(),
  })
  .strict()

/** Free Response - Algebraic */
const FreeResponseAlgebraicSchema = z
  .object({
    questionType: z.literal('free_response'),
    responseKind: z.literal('algebraic'),
    acceptedAnswers: z.array(z.string()).min(1),
  })
  .strict()

/** Free Response - Text */
const FreeResponseTextSchema = z
  .object({
    questionType: z.literal('free_response'),
    responseKind: z.literal('text'),
    acceptedAnswers: z.array(z.string()).min(1),
    caseSensitive: z.boolean().optional(),
    normalizeWhitespace: z.boolean().optional(),
  })
  .strict()

/** Free Response - Discriminated union by responseKind */
const FreeResponseAnswerSpecSchema = z.discriminatedUnion('responseKind', [
  FreeResponseNumericSchema,
  FreeResponseAlgebraicSchema,
  FreeResponseTextSchema,
])

/** Discriminated union of all answer specs */
export const AnswerSpecSchema = z.discriminatedUnion('questionType', [
  McqAnswerSpecSchema,
  TrueFalseAnswerSpecSchema,
  FreeResponseAnswerSpecSchema,
])

/** Inferred TypeScript types */
export type McqAnswerSpec = z.infer<typeof McqAnswerSpecSchema>
export type TrueFalseAnswerSpec = z.infer<typeof TrueFalseAnswerSpecSchema>
export type FreeResponseNumeric = z.infer<typeof FreeResponseNumericSchema>
export type FreeResponseAlgebraic = z.infer<typeof FreeResponseAlgebraicSchema>
export type FreeResponseText = z.infer<typeof FreeResponseTextSchema>
export type FreeResponseAnswerSpec = z.infer<typeof FreeResponseAnswerSpecSchema>
export type AnswerSpec = z.infer<typeof AnswerSpecSchema>

/**
 * System Events - Exercise Help System Schemas
 *
 * Zod schemas for the 9 exercise-related system events.
 * All schemas use .strict() to reject unknown properties.
 */

import { z } from 'zod'

const exerciseBase = {
  lesson_id: z.string().min(1, 'lesson_id is required'),
  exercise_id: z.string().min(1, 'exercise_id is required'),
  question_id: z.string().optional(),
  locale: z.string().optional(),
}

export const HintClickedSchema = z.object({ ...exerciseBase, hint_used: z.literal(true) }).strict()

export type HintClickedPayload = z.infer<typeof HintClickedSchema>

export const GuidingQuestionClickedSchema = z
  .object({ ...exerciseBase, guiding_used: z.literal(true) })
  .strict()

export type GuidingQuestionClickedPayload = z.infer<typeof GuidingQuestionClickedSchema>

export const SolutionUnlockedSchema = z
  .object({ ...exerciseBase, hint_used: z.boolean(), guiding_used: z.boolean() })
  .strict()

export type SolutionUnlockedPayload = z.infer<typeof SolutionUnlockedSchema>

export const SolutionClickedSchema = z
  .object({ ...exerciseBase, hint_used: z.boolean(), guiding_used: z.boolean() })
  .strict()

export type SolutionClickedPayload = z.infer<typeof SolutionClickedSchema>

export const StudentAnswerSubmittedSchema = z
  .object({
    ...exerciseBase,
    correctness: z.boolean().optional(),
    attempt_number: z.number().int().positive(),
  })
  .strict()

export type StudentAnswerSubmittedPayload = z.infer<typeof StudentAnswerSubmittedSchema>

export const AnswerSelectedSchema = z
  .object({
    ...exerciseBase,
    selection_type: z.enum(['mcq', 'true_false']),
  })
  .strict()

export type AnswerSelectedPayload = z.infer<typeof AnswerSelectedSchema>

export const ChatAutoTriggeredSchema = z
  .object({
    ...exerciseBase,
    trigger_reason: z.string().min(1),
  })
  .strict()

export type ChatAutoTriggeredPayload = z.infer<typeof ChatAutoTriggeredSchema>

export const ExerciseViewedSchema = z
  .object({
    lesson_id: z.string().min(1, 'lesson_id is required'),
    exercise_id: z.string().min(1, 'exercise_id is required'),
    exercise_title: z.string().optional(),
    locale: z.string().optional(),
  })
  .strict()

export type ExerciseViewedPayload = z.infer<typeof ExerciseViewedSchema>

export const ExerciseCompletedSchema = z
  .object({
    lesson_id: z.string().min(1, 'lesson_id is required'),
    exercise_id: z.string().min(1, 'exercise_id is required'),
    duration_seconds: z.number().int().nonnegative(),
    total_questions: z.number().int().nonnegative(),
    correct_count: z.number().int().nonnegative(),
    locale: z.string().optional(),
  })
  .strict()

export type ExerciseCompletedPayload = z.infer<typeof ExerciseCompletedSchema>

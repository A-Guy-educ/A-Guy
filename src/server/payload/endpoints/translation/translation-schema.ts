import { z } from 'zod'
import { CONTENT_LOCALES } from '@/server/payload/fields/contentLocale'

export const TranslateExerciseSchema = z.object({
  scope: z.literal('exercise'),
  exerciseId: z.string().min(1),
  targetLocale: z.enum(CONTENT_LOCALES),
  targetLessonId: z.string().min(1),
  promptId: z.string().optional(),
})

export const TranslateLessonSchema = z.object({
  scope: z.literal('lesson'),
  lessonId: z.string().min(1),
  targetLocale: z.enum(CONTENT_LOCALES),
  targetChapterId: z.string().min(1),
  includeExercises: z.boolean().default(true),
  promptId: z.string().optional(),
})

export const TranslateCourseSchema = z.object({
  scope: z.literal('course'),
  courseId: z.string().min(1),
  targetLocale: z.enum(CONTENT_LOCALES),
  promptId: z.string().optional(),
})

export const TranslateRequestSchema = z.discriminatedUnion('scope', [
  TranslateExerciseSchema,
  TranslateLessonSchema,
  TranslateCourseSchema,
])

export type TranslateRequest = z.infer<typeof TranslateRequestSchema>

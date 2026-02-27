/**
 * Study Plan Event Schemas
 *
 * Zod schemas for study plan system events.
 */
import { z } from 'zod'

export const StudyPlanViewedSchema = z
  .object({
    course_id: z.string().optional(),
    has_active_plan: z.boolean(),
  })
  .strict()

export const StudyPlanGeneratedSchema = z
  .object({
    course_id: z.string(),
    exam_date: z.string(),
    topic_count: z.number().int().positive(),
    timeframe_mode: z.enum(['survival', 'high_intensity', 'balanced']),
    is_regeneration: z.boolean(),
  })
  .strict()

export const StudyPlanDayCompletedSchema = z
  .object({
    course_id: z.string(),
    day_id: z.string(),
    day_index: z.number().int().min(0).max(6),
    activity_type: z.enum(['practice', 'hybrid', 'full_simulation', 'reinforcement', 'warmup']),
  })
  .strict()

export type StudyPlanViewed = z.infer<typeof StudyPlanViewedSchema>
export type StudyPlanGenerated = z.infer<typeof StudyPlanGeneratedSchema>
export type StudyPlanDayCompleted = z.infer<typeof StudyPlanDayCompletedSchema>

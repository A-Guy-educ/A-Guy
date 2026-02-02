/**
 * Chat Request Validation
 * Handles request parsing, schema validation, and initial context candidate extraction
 */
import { z } from 'zod'

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  acknowledgment: z.string().min(1),
  // Context parameters (prefer IDs over slugs)
  exerciseId: z.string().optional(),
  lessonId: z.string().optional(),
  chapterId: z.string().optional(),
  courseId: z.string().optional(),
  // Media attachments (max 5)
  mediaIds: z.array(z.string()).max(5).optional(),
  // Admin mode flag (for admin chat without context)
  adminMode: z.boolean().optional(),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

export type ContextRelation = 'exercises' | 'lessons' | 'chapters' | 'courses'

export interface ContextCandidate {
  relationTo: ContextRelation
  value: string
}

/**
 * Extract context candidate from validated request
 * Returns the most specific context (Exercise > Lesson > Chapter > Course)
 */
export function extractContextCandidate(validated: ChatRequest): ContextCandidate | null {
  if (validated.exerciseId) {
    return { relationTo: 'exercises', value: validated.exerciseId }
  }
  if (validated.lessonId) {
    return { relationTo: 'lessons', value: validated.lessonId }
  }
  if (validated.chapterId) {
    return { relationTo: 'chapters', value: validated.chapterId }
  }
  if (validated.courseId) {
    return { relationTo: 'courses', value: validated.courseId }
  }
  return null
}

/**
 * Parse and validate request body
 */
export async function parseRequestBody(
  jsonFn: () => Promise<unknown>,
): Promise<{ success: true; data: ChatRequest } | { success: false; error: z.ZodError }> {
  const body = await jsonFn()
  const result = chatRequestSchema.safeParse(body)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data }
}

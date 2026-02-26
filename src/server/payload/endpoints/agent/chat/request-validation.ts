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
  // Admin context - category for admin chat scope
  categoryId: z.string().optional(),
  // Legacy media attachments (max 5)
  mediaIds: z.array(z.string()).max(5).optional(),
  // Chat asset IDs (direct-to-Blob uploads, max 5)
  chatAssetIds: z.array(z.string()).max(5).optional(),
  // Admin mode flag (for admin chat without context)
  adminMode: z.boolean().optional(),
  // Hidden flag — message persisted for LLM context but excluded from client responses
  hidden: z.boolean().optional(),
  // Override the computed contextKey (e.g. for Ask page per-session conversations)
  contextKeyOverride: z.string().optional(),
  // When true, user message is hidden but assistant response stays visible (for help system)
  hidePromptOnly: z.boolean().optional(),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

export type ContextRelation = 'exercises' | 'lessons' | 'chapters' | 'courses' | 'categories'

export interface ContextCandidate {
  relationTo: ContextRelation
  value: string
}

/**
 * Extract context candidate from validated request
 * Returns the most specific context (Lesson > Exercise > Chapter > Course > Category)
 * Lessons take priority over exercises so all exercises in a lesson share one conversation.
 */
export function extractContextCandidate(validated: ChatRequest): ContextCandidate | null {
  if (validated.lessonId) {
    return { relationTo: 'lessons', value: validated.lessonId }
  }
  if (validated.exerciseId) {
    return { relationTo: 'exercises', value: validated.exerciseId }
  }
  if (validated.chapterId) {
    return { relationTo: 'chapters', value: validated.chapterId }
  }
  if (validated.courseId) {
    return { relationTo: 'courses', value: validated.courseId }
  }
  if (validated.categoryId) {
    return { relationTo: 'categories', value: validated.categoryId }
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

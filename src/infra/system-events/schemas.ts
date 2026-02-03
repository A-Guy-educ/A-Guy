/**
 * System Events - Zod Schemas
 *
 * Strict schema validation for all 10 system events.
 * All schemas use .strict() to reject unknown properties.
 */

import { z } from 'zod'

import { SYSTEM_EVENTS } from './events'

// ============================================================================
// Page View Event
// ============================================================================

export const PageViewedSchema = z
  .object({
    page_path: z.string().min(1, 'page_path is required'),
    page_title: z.string().optional(),
    page_search: z.string().optional(),
    locale: z.string().optional(),
  })
  .strict()

export type PageViewedPayload = z.infer<typeof PageViewedSchema>

// ============================================================================
// Session Started Event
// ============================================================================

export const SessionStartedSchema = z
  .object({
    session_id: z.string().min(1, 'session_id is required'),
    is_anonymous: z.boolean(),
    locale: z.string().optional(),
  })
  .strict()

export type SessionStartedPayload = z.infer<typeof SessionStartedSchema>

// ============================================================================
// User Resolved Event
// ============================================================================

export const UserResolvedSchema = z
  .object({
    user_id: z.string().min(1, 'user_id is required'),
    is_anonymous: z.boolean(),
    locale: z.string().optional(),
  })
  .strict()

export type UserResolvedPayload = z.infer<typeof UserResolvedSchema>

// ============================================================================
// Course Entered Event
// ============================================================================

export const CourseEnteredSchema = z
  .object({
    course_id: z.string().min(1, 'course_id is required'),
    course_title: z.string().optional(),
    locale: z.string().optional(),
  })
  .strict()

export type CourseEnteredPayload = z.infer<typeof CourseEnteredSchema>

// ============================================================================
// Lesson Started Event
// ============================================================================

export const LessonStartedSchema = z
  .object({
    lesson_id: z.string().min(1, 'lesson_id is required'),
    lesson_title: z.string().optional(),
    course_id: z.string().optional(),
    chapter_id: z.string().optional(),
    locale: z.string().optional(),
  })
  .strict()

export type LessonStartedPayload = z.infer<typeof LessonStartedSchema>

// ============================================================================
// Lesson Ended Event
// ============================================================================

export const LessonEndedSchema = z
  .object({
    lesson_id: z.string().min(1, 'lesson_id is required'),
    lesson_title: z.string().optional(),
    course_id: z.string().optional(),
    duration_seconds: z.number().int().nonnegative(),
    completion_percentage: z.number().min(0).max(100).optional(),
    locale: z.string().optional(),
  })
  .strict()

export type LessonEndedPayload = z.infer<typeof LessonEndedSchema>

// ============================================================================
// PDF Viewed Event
// ============================================================================

// URL validator that accepts both absolute URLs and /api/media relative paths
const pdfUrlSchema = z.union([
  z.string().url('pdf_url must be a valid URL'),
  z.string().regex(/^\/api\/media\//, 'pdf_url must be a valid URL or /api/media/... path'),
])

export const PdfViewedSchema = z
  .object({
    pdf_url: pdfUrlSchema,
    pdf_title: z.string().optional(),
    file_name: z.string().optional(),
    document_id: z.string().optional(),
    lesson_id: z.string().optional(),
    page_number: z.number().int().positive().optional(),
    page_count: z.number().int().positive().optional(), // Total pages in document
    duration_seconds: z.number().int().nonnegative().optional(),
    locale: z.string().optional(),
  })
  .strict()

export type PdfViewedPayload = z.infer<typeof PdfViewedSchema>

// ============================================================================
// Chat Message Submitted Event
// ============================================================================

export const ChatMessageSubmittedSchema = z
  .object({
    conversation_id: z.string().min(1, 'conversation_id is required'),
    lesson_id: z.string().optional(),
    message_type: z.enum(['user', 'assistant']),
    message_length: z.number().int().nonnegative(),
    locale: z.string().optional(),
  })
  .strict()

export type ChatMessageSubmittedPayload = z.infer<typeof ChatMessageSubmittedSchema>

// ============================================================================
// Registration Prompt Shown Event
// ============================================================================

export const RegistrationPromptShownSchema = z
  .object({
    prompt_location: z.string().min(1, 'prompt_location is required'),
    trigger_type: z.enum(['exercise_limit', 'copilot_limit', 'feature_gate', 'manual']).optional(),
    current_page: z.string().optional(),
    locale: z.string().optional(),
  })
  .strict()

export type RegistrationPromptShownPayload = z.infer<typeof RegistrationPromptShownSchema>

// ============================================================================
// Registration Completed Event
// ============================================================================

export const RegistrationCompletedSchema = z
  .object({
    user_id: z.string().min(1, 'user_id is required'),
    auth_method: z.enum(['google', 'email']).optional(),
    locale: z.string().optional(),
  })
  .strict()

export type RegistrationCompletedPayload = z.infer<typeof RegistrationCompletedSchema>

// ============================================================================
// PII Rejection Rules
// ============================================================================

/**
 * Fields that should never appear in analytics events (PII rejection).
 */
export const PII_FIELDS = ['email', 'password', 'name', 'phone', 'address'] as const

/**
 * Check if a payload contains PII fields (reject unknown fields already handles this via .strict()).
 */
export function containsPII(payload: Record<string, unknown>): string[] {
  const found: string[] = []
  for (const field of PII_FIELDS) {
    if (field in payload) {
      found.push(field)
    }
  }
  return found
}

// ============================================================================
// Schema Registry - 1:1 mapping of event names to schemas
// ============================================================================

/**
 * Registry mapping event names to their schemas.
 * Used for validation and type inference.
 */
export const eventSchemas = {
  [SYSTEM_EVENTS.PAGE_VIEWED]: PageViewedSchema,
  [SYSTEM_EVENTS.SESSION_STARTED]: SessionStartedSchema,
  [SYSTEM_EVENTS.USER_RESOLVED]: UserResolvedSchema,
  [SYSTEM_EVENTS.COURSE_ENTERED]: CourseEnteredSchema,
  [SYSTEM_EVENTS.LESSON_STARTED]: LessonStartedSchema,
  [SYSTEM_EVENTS.LESSON_ENDED]: LessonEndedSchema,
  [SYSTEM_EVENTS.PDF_VIEWED]: PdfViewedSchema,
  [SYSTEM_EVENTS.CHAT_MESSAGE_SUBMITTED]: ChatMessageSubmittedSchema,
  [SYSTEM_EVENTS.REGISTRATION_PROMPT_SHOWN]: RegistrationPromptShownSchema,
  [SYSTEM_EVENTS.REGISTRATION_COMPLETED]: RegistrationCompletedSchema,
} as const

/**
 * Type for schema values in the registry.
 */
export type EventSchema = (typeof eventSchemas)[keyof typeof eventSchemas]

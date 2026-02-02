/**
 * Event Property Schemas
 *
 * CRITICAL: No PII/content allowed
 * - ❌ NO: raw chat text, PDF contents, emails, passwords, tokens
 * - ✅ YES: IDs, counters, durations, sanitized metadata
 */

import { z } from 'zod'
import { PRODUCT_EVENTS } from './events'

/**
 * page_view - Track page navigation
 * Destination: GA4 + Mixpanel
 * Priority: P0
 */
export const PageViewSchema = z.object({
  page_path: z.string().describe('URL path (e.g., /course/123)'),
  page_title: z.string().optional().describe('Page title'),
  page_search: z.string().optional().describe('Query string'),
  locale: z.string().optional().describe('User locale (en/he)'),
})

/**
 * session_started - Track new session
 * Destination: GA4 + Mixpanel
 * Priority: P0
 */
export const SessionStartedSchema = z.object({
  session_id: z.string().describe('Client-side session identifier'),
  is_anonymous: z.boolean().describe('True if user is not logged in'),
  locale: z.string().optional().describe('User locale'),
})

/**
 * session_ended - Track session end and duration
 * Destination: GA4 + Mixpanel
 * Priority: P0
 */
export const SessionEndedSchema = z.object({
  session_id: z.string().describe('Client-side session identifier'),
  duration_seconds: z.number().describe('Total session duration'),
  page_views_count: z.number().describe('Number of pages viewed in session'),
  last_active_page: z.string().optional().describe('Last page URL before leaving'),
})

/**
 * page_abandoned - Track when user leaves a page
 * Destination: Mixpanel
 * Priority: P1
 */
export const PageAbandonedSchema = z.object({
  page_url: z.string().describe('Page URL that was abandoned'),
  time_on_page_seconds: z.number().describe('Time spent on page before leaving'),
  scroll_depth_percent: z.number().optional().describe('Max scroll percentage reached'),
})

/**
 * visibility_changed - Track tab/window visibility changes
 * Destination: Mixpanel
 * Priority: P1
 */
export const VisibilityChangedSchema = z.object({
  visibility_state: z.enum(['visible', 'hidden']).describe('Tab visibility state'),
  time_on_page_seconds: z.number().describe('Time spent on current page'),
})

/**
 * user_identified - Track user authentication
 * Destination: Mixpanel
 * Priority: P0
 *
 * This schema now includes enriched user properties for Mixpanel People.
 * These properties are sent via people.set() for user profile persistence.
 */
export const UserIdentifiedSchema = z.object({
  user_id: z.string().describe('MongoDB user ID'),

  // User identity (using Mixpanel reserved properties for better integration)
  $email: z.string().email().optional().describe('User email address'),
  $name: z.string().optional().describe('User display name'),

  is_new_user: z.boolean().optional().describe('First time signup'),
  auth_method: z.enum(['google', 'email']).optional().describe('Auth provider'),

  // User profile properties
  signup_date: z.string().optional().describe('ISO signup date'),
  role: z.string().optional().describe('User role (student, teacher, admin)'),
  locale: z.string().optional().describe('User locale preference (en/he)'),
  last_login: z.string().optional().describe('ISO date of last login'),
})

/**
 * course_entered - Track course access
 * Destination: Mixpanel
 * Priority: P0
 */
export const CourseEnteredSchema = z.object({
  course_id: z.string().describe('Course identifier'),
  course_title: z.string().optional().describe('Course name'),
})

/**
 * lesson_started - Track lesson start
 * Destination: Mixpanel
 * Priority: P0
 */
export const LessonStartedSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  course_id: z.string().describe('Parent course ID'),
  lesson_title: z.string().optional().describe('Lesson name'),
})

/**
 * lesson_completed - Track lesson completion
 * Destination: Mixpanel
 * Priority: P0
 */
export const LessonCompletedSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  course_id: z.string().describe('Parent course ID'),
  lesson_title: z.string().optional().describe('Lesson name'),
  duration_seconds: z.number().optional().describe('Time spent on lesson'),
})

/**
 * pdf_viewed - Track PDF content access
 * Destination: Mixpanel
 * Priority: P1
 *
 * NO PDF content/text - only metadata
 */
export const PdfViewedSchema = z.object({
  document_id: z.string().describe('PDF document identifier'),
  lesson_id: z.string().optional().describe('Parent lesson ID'),
  file_name: z.string().optional().describe('PDF filename (not content)'),
  page_count: z.number().optional().describe('Total pages in PDF'),
})

/**
 * chat_message_sent - Track chat interaction
 * Destination: Mixpanel
 * Priority: P1
 *
 * NO message text - only metadata
 */
export const ChatMessageSentSchema = z.object({
  conversation_id: z.string().describe('Chat conversation ID'),
  lesson_id: z.string().optional().describe('Parent lesson ID'),
  message_length: z.number().optional().describe('Character count (not content)'),
  // NO message_text - privacy violation
})

/**
 * registration_prompt_shown - Track registration modal display
 * Destination: Mixpanel
 * Priority: P0
 */
export const RegistrationPromptShownSchema = z.object({
  trigger_type: z
    .enum(['exercise_limit', 'copilot_limit', 'feature_gate', 'manual'])
    .describe('What triggered the prompt'),
  current_page: z.string().optional().describe('Page where prompt shown'),
})

/**
 * registration_completed - Track successful signup
 * Destination: GA4 + Mixpanel
 * Priority: P0
 */
export const RegistrationCompletedSchema = z.object({
  user_id: z.string().describe('MongoDB user ID'),
  auth_method: z.enum(['google', 'email']).describe('Auth provider'),
  // NO email, NO name - handled separately in user_identified
})

/**
 * Master schema mapping
 */
export const eventSchemas = {
  [PRODUCT_EVENTS.PAGE_VIEW]: PageViewSchema,
  [PRODUCT_EVENTS.SESSION_STARTED]: SessionStartedSchema,
  [PRODUCT_EVENTS.SESSION_ENDED]: SessionEndedSchema,
  [PRODUCT_EVENTS.PAGE_ABANDONED]: PageAbandonedSchema,
  [PRODUCT_EVENTS.VISIBILITY_CHANGED]: VisibilityChangedSchema,
  [PRODUCT_EVENTS.USER_IDENTIFIED]: UserIdentifiedSchema,
  [PRODUCT_EVENTS.COURSE_ENTERED]: CourseEnteredSchema,
  [PRODUCT_EVENTS.LESSON_STARTED]: LessonStartedSchema,
  [PRODUCT_EVENTS.LESSON_COMPLETED]: LessonCompletedSchema,
  [PRODUCT_EVENTS.PDF_VIEWED]: PdfViewedSchema,
  [PRODUCT_EVENTS.CHAT_MESSAGE_SENT]: ChatMessageSentSchema,
  [PRODUCT_EVENTS.REGISTRATION_PROMPT_SHOWN]: RegistrationPromptShownSchema,
  [PRODUCT_EVENTS.REGISTRATION_COMPLETED]: RegistrationCompletedSchema,
} as const

/**
 * Inferred TypeScript types from Zod schemas
 */
export type PageViewProperties = z.infer<typeof PageViewSchema>
export type SessionStartedProperties = z.infer<typeof SessionStartedSchema>
export type SessionEndedProperties = z.infer<typeof SessionEndedSchema>
export type PageAbandonedProperties = z.infer<typeof PageAbandonedSchema>
export type VisibilityChangedProperties = z.infer<typeof VisibilityChangedSchema>
export type UserIdentifiedProperties = z.infer<typeof UserIdentifiedSchema>
export type CourseEnteredProperties = z.infer<typeof CourseEnteredSchema>
export type LessonStartedProperties = z.infer<typeof LessonStartedSchema>
export type LessonCompletedProperties = z.infer<typeof LessonCompletedSchema>
export type PdfViewedProperties = z.infer<typeof PdfViewedSchema>
export type ChatMessageSentProperties = z.infer<typeof ChatMessageSentSchema>
export type RegistrationPromptShownProperties = z.infer<typeof RegistrationPromptShownSchema>
export type RegistrationCompletedProperties = z.infer<typeof RegistrationCompletedSchema>

/**
 * Union type of all event properties
 */
export type EventProperties =
  | PageViewProperties
  | SessionStartedProperties
  | SessionEndedProperties
  | PageAbandonedProperties
  | VisibilityChangedProperties
  | UserIdentifiedProperties
  | CourseEnteredProperties
  | LessonStartedProperties
  | LessonCompletedProperties
  | PdfViewedProperties
  | ChatMessageSentProperties
  | RegistrationPromptShownProperties
  | RegistrationCompletedProperties

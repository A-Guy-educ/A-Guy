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
 * tab_away - User switched away from tab
 * Destination: Mixpanel
 * Priority: P1
 */
export const TabAwaySchema = z.object({
  page_url: z.string().describe('Page URL when user left'),
  time_on_page_seconds: z.number().describe('Time spent on page before leaving'),
  scroll_depth_percent: z.number().optional().describe('Max scroll percentage reached'),
})

/**
 * tab_back - User returned to tab
 * Destination: Mixpanel
 * Priority: P1
 */
export const TabBackSchema = z.object({
  page_url: z.string().describe('Page URL when user returned'),
  time_on_page_seconds: z.number().describe('Time spent away'),
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
 * login_modal_shown - Auth gate modal appeared for anonymous user
 * Destination: Mixpanel
 * Priority: P0
 */
export const LoginModalShownSchema = z.object({
  trigger_type: z
    .enum(['mandatory', 'gated', 'warning', 'paid'])
    .describe('Which access gate triggered the modal'),
  course_slug: z.string().describe('Course where modal appeared'),
  current_page: z.string().optional().describe('Page URL when modal shown'),
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
 * hint_clicked - Track hint button usage
 * Destination: Mixpanel
 * Priority: P1
 */
export const HintClickedSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  exercise_id: z.string().describe('Exercise identifier'),
  question_id: z.string().optional().describe('Question identifier'),
  hint_used: z.literal(true).describe('Hint was used'),
  locale: z.string().optional().describe('User locale'),
})

/**
 * guiding_question_clicked - Track guiding question usage
 * Destination: Mixpanel
 * Priority: P1
 */
export const GuidingQuestionClickedSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  exercise_id: z.string().describe('Exercise identifier'),
  question_id: z.string().optional().describe('Question identifier'),
  guiding_used: z.literal(true).describe('Guiding question was used'),
  locale: z.string().optional().describe('User locale'),
})

/**
 * solution_unlocked - Track solution unlock (after hint + guiding)
 * Destination: Mixpanel
 * Priority: P1
 */
export const SolutionUnlockedSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  exercise_id: z.string().describe('Exercise identifier'),
  question_id: z.string().optional().describe('Question identifier'),
  hint_used: z.boolean().describe('Whether hint was used before unlock'),
  guiding_used: z.boolean().describe('Whether guiding was used before unlock'),
  locale: z.string().optional().describe('User locale'),
})

/**
 * solution_clicked - Track solution view
 * Destination: Mixpanel
 * Priority: P1
 */
export const SolutionClickedSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  exercise_id: z.string().describe('Exercise identifier'),
  question_id: z.string().optional().describe('Question identifier'),
  hint_used: z.boolean().describe('Whether hint was used'),
  guiding_used: z.boolean().describe('Whether guiding was used'),
  locale: z.string().optional().describe('User locale'),
})

/**
 * student_answer_submitted - Track answer submission
 * Destination: Mixpanel
 * Priority: P0
 *
 * NO answer text - only metadata
 */
export const StudentAnswerSubmittedSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  exercise_id: z.string().describe('Exercise identifier'),
  question_id: z.string().optional().describe('Question identifier'),
  correctness: z.boolean().optional().describe('Whether answer was correct'),
  attempt_number: z.number().int().positive().describe('Attempt number'),
  locale: z.string().optional().describe('User locale'),
})

/**
 * answer_selected - Track answer selection (MCQ/TF)
 * Destination: Mixpanel
 * Priority: P1
 */
export const AnswerSelectedSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  exercise_id: z.string().describe('Exercise identifier'),
  question_id: z.string().optional().describe('Question identifier'),
  selection_type: z.enum(['mcq', 'true_false']).describe('Answer type'),
  locale: z.string().optional().describe('User locale'),
})

/**
 * chat_auto_triggered - Track automatic chat triggers
 * Destination: Mixpanel
 * Priority: P1
 */
export const ChatAutoTriggeredSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  exercise_id: z.string().describe('Exercise identifier'),
  question_id: z.string().optional().describe('Question identifier'),
  trigger_reason: z.string().describe('Reason for auto-trigger'),
  locale: z.string().optional().describe('User locale'),
})

/**
 * exercise_viewed - Track exercise view
 * Destination: Mixpanel
 * Priority: P0
 */
export const ExerciseViewedSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  exercise_id: z.string().describe('Exercise identifier'),
  exercise_title: z.string().optional().describe('Exercise title'),
  locale: z.string().optional().describe('User locale'),
})

/**
 * exercise_completed - Track exercise completion
 * Destination: Mixpanel
 * Priority: P0
 */
export const ExerciseCompletedSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  exercise_id: z.string().describe('Exercise identifier'),
  duration_seconds: z.number().int().nonnegative().describe('Time to complete'),
  total_questions: z.number().int().nonnegative().describe('Total questions'),
  correct_count: z.number().int().nonnegative().describe('Correct answers'),
  locale: z.string().optional().describe('User locale'),
})

/**
 * Master schema mapping
 */
export const eventSchemas = {
  [PRODUCT_EVENTS.PAGE_VIEW]: PageViewSchema,
  [PRODUCT_EVENTS.SESSION_STARTED]: SessionStartedSchema,
  [PRODUCT_EVENTS.SESSION_ENDED]: SessionEndedSchema,
  [PRODUCT_EVENTS.TAB_AWAY]: TabAwaySchema,
  [PRODUCT_EVENTS.TAB_BACK]: TabBackSchema,
  [PRODUCT_EVENTS.USER_IDENTIFIED]: UserIdentifiedSchema,
  [PRODUCT_EVENTS.COURSE_ENTERED]: CourseEnteredSchema,
  [PRODUCT_EVENTS.LESSON_STARTED]: LessonStartedSchema,
  [PRODUCT_EVENTS.LESSON_COMPLETED]: LessonCompletedSchema,
  [PRODUCT_EVENTS.PDF_VIEWED]: PdfViewedSchema,
  [PRODUCT_EVENTS.CHAT_MESSAGE_SENT]: ChatMessageSentSchema,
  [PRODUCT_EVENTS.LOGIN_MODAL_SHOWN]: LoginModalShownSchema,
  [PRODUCT_EVENTS.REGISTRATION_PROMPT_SHOWN]: RegistrationPromptShownSchema,
  [PRODUCT_EVENTS.REGISTRATION_COMPLETED]: RegistrationCompletedSchema,

  // Exercise Help System Events
  [PRODUCT_EVENTS.HINT_CLICKED]: HintClickedSchema,
  [PRODUCT_EVENTS.GUIDING_QUESTION_CLICKED]: GuidingQuestionClickedSchema,
  [PRODUCT_EVENTS.SOLUTION_UNLOCKED]: SolutionUnlockedSchema,
  [PRODUCT_EVENTS.SOLUTION_CLICKED]: SolutionClickedSchema,
  [PRODUCT_EVENTS.STUDENT_ANSWER_SUBMITTED]: StudentAnswerSubmittedSchema,
  [PRODUCT_EVENTS.ANSWER_SELECTED]: AnswerSelectedSchema,
  [PRODUCT_EVENTS.CHAT_AUTO_TRIGGERED]: ChatAutoTriggeredSchema,
  [PRODUCT_EVENTS.EXERCISE_VIEWED]: ExerciseViewedSchema,
  [PRODUCT_EVENTS.EXERCISE_COMPLETED]: ExerciseCompletedSchema,
} as const

/**
 * Inferred TypeScript types from Zod schemas
 */
export type PageViewProperties = z.infer<typeof PageViewSchema>
export type SessionStartedProperties = z.infer<typeof SessionStartedSchema>
export type SessionEndedProperties = z.infer<typeof SessionEndedSchema>
export type TabAwayProperties = z.infer<typeof TabAwaySchema>
export type TabBackProperties = z.infer<typeof TabBackSchema>
export type UserIdentifiedProperties = z.infer<typeof UserIdentifiedSchema>
export type CourseEnteredProperties = z.infer<typeof CourseEnteredSchema>
export type LessonStartedProperties = z.infer<typeof LessonStartedSchema>
export type LessonCompletedProperties = z.infer<typeof LessonCompletedSchema>
export type PdfViewedProperties = z.infer<typeof PdfViewedSchema>
export type ChatMessageSentProperties = z.infer<typeof ChatMessageSentSchema>
export type LoginModalShownProperties = z.infer<typeof LoginModalShownSchema>
export type RegistrationPromptShownProperties = z.infer<typeof RegistrationPromptShownSchema>
export type RegistrationCompletedProperties = z.infer<typeof RegistrationCompletedSchema>

// Exercise Help System
export type HintClickedProperties = z.infer<typeof HintClickedSchema>
export type GuidingQuestionClickedProperties = z.infer<typeof GuidingQuestionClickedSchema>
export type SolutionUnlockedProperties = z.infer<typeof SolutionUnlockedSchema>
export type SolutionClickedProperties = z.infer<typeof SolutionClickedSchema>
export type StudentAnswerSubmittedProperties = z.infer<typeof StudentAnswerSubmittedSchema>
export type AnswerSelectedProperties = z.infer<typeof AnswerSelectedSchema>
export type ChatAutoTriggeredProperties = z.infer<typeof ChatAutoTriggeredSchema>
export type ExerciseViewedProperties = z.infer<typeof ExerciseViewedSchema>
export type ExerciseCompletedProperties = z.infer<typeof ExerciseCompletedSchema>

/**
 * Union type of all event properties
 */
export type EventProperties =
  | PageViewProperties
  | SessionStartedProperties
  | SessionEndedProperties
  | TabAwayProperties
  | TabBackProperties
  | UserIdentifiedProperties
  | CourseEnteredProperties
  | LessonStartedProperties
  | LessonCompletedProperties
  | PdfViewedProperties
  | ChatMessageSentProperties
  | LoginModalShownProperties
  | RegistrationPromptShownProperties
  | RegistrationCompletedProperties
  | HintClickedProperties
  | GuidingQuestionClickedProperties
  | SolutionUnlockedProperties
  | SolutionClickedProperties
  | StudentAnswerSubmittedProperties
  | AnswerSelectedProperties
  | ChatAutoTriggeredProperties
  | ExerciseViewedProperties
  | ExerciseCompletedProperties

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
  course_id: z.string().optional().describe('Parent course ID'),
  chapter_id: z.string().optional().describe('Parent chapter ID'),
  lesson_title: z.string().optional().describe('Lesson name'),
  locale: z.string().optional().describe('User locale'),
})

/**
 * lesson_completed - Track lesson completion
 * Destination: Mixpanel
 * Priority: P0
 */
export const LessonCompletedSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  course_id: z.string().optional().describe('Parent course ID'),
  lesson_title: z.string().optional().describe('Lesson name'),
  duration_seconds: z.number().optional().describe('Time spent on lesson'),
  completion_percentage: z.number().min(0).max(100).optional().describe('Lesson completion %'),
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
 * photo_sent_to_chat - Track photo/file upload to chat
 * Destination: Mixpanel
 * Priority: P1
 *
 * NO file content - only metadata
 */
export const PhotoSentToChatSchema = z.object({
  conversation_id: z.string().describe('Chat conversation ID'),
  file_count: z.number().int().positive().describe('Number of files uploaded'),
  file_types: z.array(z.string()).describe('MIME types of uploaded files'),
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
 * registration_popup_shown - Auth gate popup shown to anonymous user
 * Destination: Mixpanel
 * Priority: P0
 */
export const RegistrationPopupShownSchema = z.object({
  page_path: z.string().describe('Page URL where the popup was shown'),
  trigger_type: z
    .enum(['mandatory', 'gated', 'warning'])
    .describe('Which access gate triggered the popup'),
  course_slug: z.string().optional().describe('Course where popup appeared'),
})

/**
 * registration_popup_action - User action on registration popup
 * Destination: Mixpanel
 * Priority: P0
 */
export const RegistrationPopupActionSchema = z.object({
  outcome: z
    .enum(['Registered', 'Did Not Register'])
    .describe('Whether the user registered or dismissed'),
  method: z.string().optional().describe('Registration method (Email, Google)'),
  page_path: z.string().optional().describe('Page URL where action was taken'),
})

/**
 * registration_completed - Track successful signup
 * Destination: GA4 + Mixpanel
 * Priority: P0
 */
export const RegistrationCompletedSchema = z.object({
  user_id: z.string().describe('MongoDB user ID'),
  registration_method: z
    .enum(['google', 'email', 'social', 'anonymous_upgrade'])
    .optional()
    .describe('Auth provider'),
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
 * coupon_code_entered - Track coupon code usage
 * Destination: Mixpanel
 * Priority: P0
 */
export const CouponCodeEnteredPropertiesSchema = z.object({
  coupon_code: z.string().describe('Coupon code entered'),
  lesson_id: z.string().describe('Lesson identifier'),
  course_id: z.string().describe('Course identifier'),
})

/**
 * access_gate_shown - Track paywall/login gate display
 * Destination: Mixpanel
 * Priority: P0
 */
export const AccessGateShownPropertiesSchema = z.object({
  gate_type: z.enum(['free', 'login', 'paid', 'coupon']).describe('Type of access gate'),
  lesson_id: z.string().describe('Lesson identifier'),
  course_id: z.string().describe('Course identifier'),
})

/**
 * access_granted - Track content access grants
 * Destination: Mixpanel
 * Priority: P0
 */
export const AccessGrantedPropertiesSchema = z.object({
  access_type: z.enum(['free', 'coupon', 'paid']).describe('How access was granted'),
  coupon_code: z.string().optional().describe('Coupon code if applicable'),
  lesson_id: z.string().describe('Lesson identifier'),
  course_id: z.string().describe('Course identifier'),
})

/**
 * answer_correct - Track correct answers
 * Destination: Mixpanel
 * Priority: P0
 */
export const AnswerCorrectPropertiesSchema = z.object({
  exercise_id: z.string().describe('Exercise identifier'),
  lesson_id: z.string().describe('Lesson identifier'),
  time_seconds: z.number().describe('Time taken to answer'),
  attempt_number: z.number().int().positive().describe('Attempt number'),
  difficulty_level: z.enum(['easy', 'medium', 'hard']).describe('Exercise difficulty'),
})

/**
 * answer_incorrect - Track incorrect answers
 * Destination: Mixpanel
 * Priority: P0
 */
export const AnswerIncorrectPropertiesSchema = z.object({
  exercise_id: z.string().describe('Exercise identifier'),
  lesson_id: z.string().describe('Lesson identifier'),
  attempt_number: z.number().int().positive().describe('Attempt number'),
  max_attempts: z.number().int().positive().describe('Maximum allowed attempts'),
  time_seconds: z.number().describe('Time taken to answer'),
})

/**
 * exercise_skipped - Track skipped exercises
 * Destination: Mixpanel
 * Priority: P0
 */
export const ExerciseSkippedPropertiesSchema = z.object({
  exercise_id: z.string().describe('Exercise identifier'),
  lesson_id: z.string().describe('Lesson identifier'),
  reason: z.string().describe('Reason for skipping'),
})

/**
 * lesson_open_attempted - Track user clicking to open a lesson
 * Destination: Mixpanel
 * Priority: P0
 */
export const LessonOpenAttemptedPropertiesSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  content_type: z.enum(['pdf', 'exercises', 'blocks']).describe('Type of lesson content'),
  platform: z.string().describe('Client platform (web)'),
  course_id: z.string().optional().describe('Parent course ID'),
})

/**
 * lesson_load_success - Track successful lesson content render
 * Destination: Mixpanel
 * Priority: P0
 */
export const LessonLoadSuccessPropertiesSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  content_type: z.enum(['pdf', 'exercises', 'blocks']).describe('Type of lesson content'),
  load_time_ms: z.number().nonnegative().describe('Time from click to render in ms'),
  course_id: z.string().optional().describe('Parent course ID'),
})

/**
 * lesson_load_failed - Track lesson load failure
 * Destination: Mixpanel
 * Priority: P0
 */
export const LessonLoadFailedPropertiesSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  content_type: z
    .enum(['pdf', 'exercises', 'blocks'])
    .optional()
    .describe('Type of lesson content'),
  error_type: z.enum(['404', 'timeout', 'js_error']).describe('Category of failure'),
  error_message: z.string().optional().describe('Error details (no PII)'),
  course_id: z.string().optional().describe('Parent course ID'),
})

/**
 * lesson_abandoned - Track lesson abandonment
 * Destination: Mixpanel
 * Priority: P0
 */
export const LessonAbandonedPropertiesSchema = z.object({
  lesson_id: z.string().describe('Lesson identifier'),
  course_id: z.string().describe('Course identifier'),
  time_spent_seconds: z.number().describe('Time spent on lesson'),
  progress_percent: z.number().describe('Completion percentage'),
  exercises_attempted: z.number().int().nonnegative().describe('Exercises attempted'),
  exercises_completed: z.number().int().nonnegative().describe('Exercises completed'),
})

/**
 * chapter_completed - Track chapter completion
 * Destination: Mixpanel
 * Priority: P0
 */
export const ChapterCompletedPropertiesSchema = z.object({
  course_id: z.string().describe('Course identifier'),
  chapter_id: z.string().describe('Chapter identifier'),
  total_lessons: z.number().int().positive().describe('Total lessons in chapter'),
  completion_time_seconds: z.number().describe('Time to complete chapter'),
})

/**
 * time_on_page - Track time threshold signals
 * Destination: Mixpanel
 * Priority: P0
 */
export const TimeOnPagePropertiesSchema = z.object({
  page_url: z.string().describe('Page URL'),
  time_seconds: z.number().describe('Time threshold reached (30/60/120/300/600)'),
  scroll_depth_percent: z.number().optional().describe('Max scroll depth percentage'),
  user_interacted: z.boolean().describe('Whether user scrolled'),
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
  [PRODUCT_EVENTS.PHOTO_SENT_TO_CHAT]: PhotoSentToChatSchema,
  [PRODUCT_EVENTS.LOGIN_MODAL_SHOWN]: LoginModalShownSchema,
  [PRODUCT_EVENTS.REGISTRATION_PROMPT_SHOWN]: RegistrationPromptShownSchema,
  [PRODUCT_EVENTS.REGISTRATION_POPUP_SHOWN]: RegistrationPopupShownSchema,
  [PRODUCT_EVENTS.REGISTRATION_POPUP_ACTION]: RegistrationPopupActionSchema,
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

  // Coupon & Access Events
  [PRODUCT_EVENTS.COUPON_CODE_ENTERED]: CouponCodeEnteredPropertiesSchema,
  [PRODUCT_EVENTS.ACCESS_GATE_SHOWN]: AccessGateShownPropertiesSchema,
  [PRODUCT_EVENTS.ACCESS_GRANTED]: AccessGrantedPropertiesSchema,

  // Exercise Quality Events
  [PRODUCT_EVENTS.ANSWER_CORRECT]: AnswerCorrectPropertiesSchema,
  [PRODUCT_EVENTS.ANSWER_INCORRECT]: AnswerIncorrectPropertiesSchema,
  [PRODUCT_EVENTS.EXERCISE_SKIPPED]: ExerciseSkippedPropertiesSchema,

  // Lesson Loading Lifecycle Events
  [PRODUCT_EVENTS.LESSON_OPEN_ATTEMPTED]: LessonOpenAttemptedPropertiesSchema,
  [PRODUCT_EVENTS.LESSON_LOAD_SUCCESS]: LessonLoadSuccessPropertiesSchema,
  [PRODUCT_EVENTS.LESSON_LOAD_FAILED]: LessonLoadFailedPropertiesSchema,

  // Engagement Signal Events
  [PRODUCT_EVENTS.LESSON_ABANDONED]: LessonAbandonedPropertiesSchema,
  [PRODUCT_EVENTS.CHAPTER_COMPLETED]: ChapterCompletedPropertiesSchema,
  [PRODUCT_EVENTS.TIME_ON_PAGE]: TimeOnPagePropertiesSchema,
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
export type PhotoSentToChatProperties = z.infer<typeof PhotoSentToChatSchema>
export type LoginModalShownProperties = z.infer<typeof LoginModalShownSchema>
export type RegistrationPromptShownProperties = z.infer<typeof RegistrationPromptShownSchema>
export type RegistrationPopupShownProperties = z.infer<typeof RegistrationPopupShownSchema>
export type RegistrationPopupActionProperties = z.infer<typeof RegistrationPopupActionSchema>
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

// Coupon & Access
export type CouponCodeEnteredProperties = z.infer<typeof CouponCodeEnteredPropertiesSchema>
export type AccessGateShownProperties = z.infer<typeof AccessGateShownPropertiesSchema>
export type AccessGrantedProperties = z.infer<typeof AccessGrantedPropertiesSchema>

// Exercise Quality
export type AnswerCorrectProperties = z.infer<typeof AnswerCorrectPropertiesSchema>
export type AnswerIncorrectProperties = z.infer<typeof AnswerIncorrectPropertiesSchema>
export type ExerciseSkippedProperties = z.infer<typeof ExerciseSkippedPropertiesSchema>

// Lesson Loading Lifecycle
export type LessonOpenAttemptedProperties = z.infer<typeof LessonOpenAttemptedPropertiesSchema>
export type LessonLoadSuccessProperties = z.infer<typeof LessonLoadSuccessPropertiesSchema>
export type LessonLoadFailedProperties = z.infer<typeof LessonLoadFailedPropertiesSchema>

// Engagement Signals
export type LessonAbandonedProperties = z.infer<typeof LessonAbandonedPropertiesSchema>
export type ChapterCompletedProperties = z.infer<typeof ChapterCompletedPropertiesSchema>
export type TimeOnPageProperties = z.infer<typeof TimeOnPagePropertiesSchema>

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
  | PhotoSentToChatProperties
  | LoginModalShownProperties
  | RegistrationPromptShownProperties
  | RegistrationPopupShownProperties
  | RegistrationPopupActionProperties
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
  | CouponCodeEnteredProperties
  | AccessGateShownProperties
  | AccessGrantedProperties
  | AnswerCorrectProperties
  | AnswerIncorrectProperties
  | ExerciseSkippedProperties
  | LessonOpenAttemptedProperties
  | LessonLoadSuccessProperties
  | LessonLoadFailedProperties
  | LessonAbandonedProperties
  | ChapterCompletedProperties
  | TimeOnPageProperties

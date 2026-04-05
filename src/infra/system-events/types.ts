/**
 * System Events - Type Definitions
 *
 * Type definitions for the event bus, envelopes, and handler types.
 */

import type { SystemEventName } from './events'
import type {
  AnswerSelectedPayload,
  ChatAutoTriggeredPayload,
  ExerciseCompletedPayload,
  ExerciseViewedPayload,
  GuidingQuestionClickedPayload,
  HintClickedPayload,
  SolutionClickedPayload,
  SolutionUnlockedPayload,
  StudentAnswerSubmittedPayload,
} from './exercise-schemas'
import type {
  AccessGateShownPayload,
  AccessGrantedPayload,
  AnswerCorrectPayload,
  AnswerIncorrectPayload,
  ChapterCompletedPayload,
  ChatMessageSubmittedPayload,
  PhotoSentToChatPayload,
  CouponCodeEnteredPayload,
  CourseEnteredPayload,
  ExerciseSkippedPayload,
  LessonAbandonedPayload,
  LessonEndedPayload,
  LessonLoadFailedPayload,
  LessonLoadSuccessPayload,
  LessonOpenAttemptedPayload,
  LessonStartedPayload,
  LoginModalShownPayload,
  PageViewedPayload,
  PdfViewedPayload,
  RegistrationCompletedPayload,
  RegistrationPromptShownPayload,
  SessionStartedPayload,
  SiteInitPayload,
  TimeOnPagePayload,
  UserResolvedPayload,
} from './schemas'
import type {
  StudyPlanDayCompleted,
  StudyPlanGenerated,
  StudyPlanViewed,
} from './study-plan-schemas'

// Re-export for convenience
export type { SystemEventName } from './events'

/**
 * Metadata attached to every event envelope.
 */
export interface SystemEventMeta {
  timestamp: number // Unix ms via Date.now()
  session_id: string // From sessionStorage
  route?: string // window.location.pathname
  bus_version: 'v0'
}

/**
 * Envelope structure wrapping payload with metadata.
 */
export interface SystemEventEnvelope<T> {
  name: SystemEventName
  payload: T
  meta: SystemEventMeta
}

/**
 * Per-event payload type mapping (must match schemas exactly).
 */
export type SystemEventPayloads = {
  'system.site_init': SiteInitPayload
  'system.page_viewed': PageViewedPayload
  'system.session_started': SessionStartedPayload
  'system.user_resolved': UserResolvedPayload
  'system.course_entered': CourseEnteredPayload
  'system.lesson_started': LessonStartedPayload
  'system.lesson_ended': LessonEndedPayload
  'system.pdf_viewed': PdfViewedPayload
  'system.chat_message_submitted': ChatMessageSubmittedPayload
  'system.photo_sent_to_chat': PhotoSentToChatPayload
  'system.login_modal_shown': LoginModalShownPayload
  'system.registration_prompt_shown': RegistrationPromptShownPayload
  'system.registration_completed': RegistrationCompletedPayload

  // Exercise Help System
  'system.hint_clicked': HintClickedPayload
  'system.guiding_question_clicked': GuidingQuestionClickedPayload
  'system.solution_unlocked': SolutionUnlockedPayload
  'system.solution_clicked': SolutionClickedPayload
  'system.student_answer_submitted': StudentAnswerSubmittedPayload
  'system.answer_selected': AnswerSelectedPayload
  'system.chat_auto_triggered': ChatAutoTriggeredPayload
  'system.exercise_viewed': ExerciseViewedPayload
  'system.exercise_completed': ExerciseCompletedPayload

  // Study Plan System
  'system.study_plan_viewed': StudyPlanViewed
  'system.study_plan_generated': StudyPlanGenerated
  'system.study_plan_day_completed': StudyPlanDayCompleted

  // Coupon & Access
  'system.coupon_code_entered': CouponCodeEnteredPayload
  'system.access_gate_shown': AccessGateShownPayload
  'system.access_granted': AccessGrantedPayload

  // Exercise Quality
  'system.answer_correct': AnswerCorrectPayload
  'system.answer_incorrect': AnswerIncorrectPayload
  'system.exercise_skipped': ExerciseSkippedPayload

  // Lesson Loading Lifecycle
  'system.lesson_open_attempted': LessonOpenAttemptedPayload
  'system.lesson_load_success': LessonLoadSuccessPayload
  'system.lesson_load_failed': LessonLoadFailedPayload

  // Engagement Signals
  'system.lesson_abandoned': LessonAbandonedPayload
  'system.chapter_completed': ChapterCompletedPayload
  'system.time_on_page': TimeOnPagePayload
}

/**
 * Handler type for specific event subscriptions.
 */
export type SystemEventHandler<E extends SystemEventName> = (
  envelope: SystemEventEnvelope<SystemEventPayloads[E]>,
) => void

/**
 * Handler type for subscribing to all events.
 * Uses unknown payload since we don't know which event type will be received.
 */
export type AnySystemEventHandler = (envelope: SystemEventEnvelope<unknown>) => void

/**
 * Unsubscribe function returned by subscription methods.
 */
export type Unsubscribe = () => void

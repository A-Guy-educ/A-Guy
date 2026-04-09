/**
 * System Events - Event Constants
 *
 * Centralized event name constants with system namespace prefix.
 */

/**
 * All system events with `system.` namespace prefix.
 * Use these constants when emitting or subscribing to events.
 */
export const SYSTEM_EVENTS = {
  /** Site initialized (fired once on app mount) */
  SITE_INIT: 'system.site_init',
  /** User viewed a page */
  PAGE_VIEWED: 'system.page_viewed',
  /** New session started (first event in session) */
  SESSION_STARTED: 'system.session_started',
  /** User identity resolved (logged in or confirmed anonymous) */
  USER_RESOLVED: 'system.user_resolved',
  /** User entered a course page */
  COURSE_ENTERED: 'system.course_entered',
  /** User started a lesson */
  LESSON_STARTED: 'system.lesson_started',
  /** User ended a lesson */
  LESSON_ENDED: 'system.lesson_ended',
  /** User viewed a PDF document */
  PDF_VIEWED: 'system.pdf_viewed',
  /** User submitted a chat message */
  CHAT_MESSAGE_SUBMITTED: 'system.chat_message_submitted',
  /** Login modal shown to anonymous user (auth gate) */
  LOGIN_MODAL_SHOWN: 'system.login_modal_shown',
  /** Registration prompt shown to user */
  REGISTRATION_PROMPT_SHOWN: 'system.registration_prompt_shown',
  /** User completed registration */
  REGISTRATION_COMPLETED: 'system.registration_completed',

  // Exercise Help System Events
  /** User clicked hint button on a question */
  HINT_CLICKED: 'system.hint_clicked',
  /** User clicked guiding question button */
  GUIDING_QUESTION_CLICKED: 'system.guiding_question_clicked',
  /** Solution became available (hint + guiding both used) */
  SOLUTION_UNLOCKED: 'system.solution_unlocked',
  /** User clicked solution button */
  SOLUTION_CLICKED: 'system.solution_clicked',
  /** Student submitted an answer for checking */
  STUDENT_ANSWER_SUBMITTED: 'system.student_answer_submitted',
  /** Student selected an answer option (MCQ/TF) */
  ANSWER_SELECTED: 'system.answer_selected',
  /** User sent a photo/file to chat */
  PHOTO_SENT_TO_CHAT: 'system.photo_sent_to_chat',
  /** Chat was auto-triggered (e.g. on incorrect answer) */
  CHAT_AUTO_TRIGGERED: 'system.chat_auto_triggered',
  /** User viewed an exercise */
  EXERCISE_VIEWED: 'system.exercise_viewed',
  /** User completed an exercise (all questions correct) */
  EXERCISE_COMPLETED: 'system.exercise_completed',

  // Study Plan Events
  /** User viewed the study plan page */
  STUDY_PLAN_VIEWED: 'system.study_plan_viewed',
  /** User generated a new study plan */
  STUDY_PLAN_GENERATED: 'system.study_plan_generated',
  /** User completed a study plan day */
  STUDY_PLAN_DAY_COMPLETED: 'system.study_plan_day_completed',

  // Coupon & Access Events
  /** User entered a coupon code to access lesson */
  COUPON_CODE_ENTERED: 'system.coupon_code_entered',
  /** User encounters paywall/login gate */
  ACCESS_GATE_SHOWN: 'system.access_gate_shown',
  /** User gains access to content */
  ACCESS_GRANTED: 'system.access_granted',

  // Exercise Quality Events
  /** User gets answer right on first attempt */
  ANSWER_CORRECT: 'system.answer_correct',
  /** User gets answer wrong */
  ANSWER_INCORRECT: 'system.answer_incorrect',
  /** User skips exercise without answering */
  EXERCISE_SKIPPED: 'system.exercise_skipped',

  // Lesson Loading Lifecycle Events
  /** User clicked to open a lesson (before navigation) */
  LESSON_OPEN_ATTEMPTED: 'system.lesson_open_attempted',
  /** Lesson content fully rendered successfully */
  LESSON_LOAD_SUCCESS: 'system.lesson_load_success',
  /** Lesson content failed to load (404, timeout, JS error) */
  LESSON_LOAD_FAILED: 'system.lesson_load_failed',

  // Engagement Signal Events
  /** User leaves lesson incomplete */
  LESSON_ABANDONED: 'system.lesson_abandoned',
  /** User finishes all lessons in chapter */
  CHAPTER_COMPLETED: 'system.chapter_completed',
  /** Abandonment signal at time thresholds */
  TIME_ON_PAGE: 'system.time_on_page',
} as const

/**
 * Type representing all valid system event names.
 */
export type SystemEventName = (typeof SYSTEM_EVENTS)[keyof typeof SYSTEM_EVENTS]

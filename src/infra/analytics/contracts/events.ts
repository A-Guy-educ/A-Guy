/**
 * Canonical Product Events (v1)
 *
 * These are the ONLY allowed events in this phase.
 * Adding a new event requires:
 * 1. Update this file
 * 2. Add schema in schemas.ts
 * 3. Add destination in destinations.ts
 * 4. Update documentation
 *
 * Naming Convention: lowercase_with_underscores
 * - Past tense for completed actions: lesson_completed
 * - Present tense for ongoing: page_view
 */

export const PRODUCT_EVENTS = {
  // Page & Session Events (GA4 + Mixpanel)
  PAGE_VIEW: 'page_view',
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended', // GA4 + Mixpanel - tracks session duration
  TAB_AWAY: 'tab_away', // Mixpanel only - user switched away from tab
  TAB_BACK: 'tab_back', // Mixpanel only - user returned to tab

  // User Identity (Mixpanel only)
  USER_IDENTIFIED: 'user_identified',

  // Course & Lesson Events (Mixpanel only)
  COURSE_ENTERED: 'course_entered',
  LESSON_STARTED: 'lesson_started',
  LESSON_COMPLETED: 'lesson_completed',

  // Content Events (Mixpanel only)
  PDF_VIEWED: 'pdf_viewed',
  CHAT_MESSAGE_SENT: 'chat_message_sent',

  // Auth Gate Events
  LOGIN_MODAL_SHOWN: 'login_modal_shown', // Mixpanel only - auth gate modal appeared

  // Registration Events
  REGISTRATION_PROMPT_SHOWN: 'registration_prompt_shown',
  REGISTRATION_COMPLETED: 'registration_completed', // GA4 + Mixpanel

  // Exercise Help System Events (Mixpanel only)
  HINT_CLICKED: 'hint_clicked',
  GUIDING_QUESTION_CLICKED: 'guiding_question_clicked',
  SOLUTION_UNLOCKED: 'solution_unlocked',
  SOLUTION_CLICKED: 'solution_clicked',
  STUDENT_ANSWER_SUBMITTED: 'student_answer_submitted',
  ANSWER_SELECTED: 'answer_selected',
  CHAT_AUTO_TRIGGERED: 'chat_auto_triggered',
  EXERCISE_VIEWED: 'exercise_viewed',
  EXERCISE_COMPLETED: 'exercise_completed',

  // Coupon & Access Events (Mixpanel only)
  COUPON_CODE_ENTERED: 'coupon_code_entered',
  ACCESS_GATE_SHOWN: 'access_gate_shown',
  ACCESS_GRANTED: 'access_granted',

  // Exercise Quality Events (Mixpanel only)
  ANSWER_CORRECT: 'answer_correct',
  ANSWER_INCORRECT: 'answer_incorrect',
  EXERCISE_SKIPPED: 'exercise_skipped',

  // Engagement Signal Events (Mixpanel only)
  LESSON_ABANDONED: 'lesson_abandoned',
  CHAPTER_COMPLETED: 'chapter_completed',
  TIME_ON_PAGE: 'time_on_page',
} as const

/**
 * Type-safe event names
 */
export type ProductEvent = (typeof PRODUCT_EVENTS)[keyof typeof PRODUCT_EVENTS]

/**
 * Reverse lookup for validation
 */
export const VALID_EVENTS = new Set(Object.values(PRODUCT_EVENTS))

/**
 * Check if an event name is valid
 */
export function isValidEvent(event: string): event is ProductEvent {
  return VALID_EVENTS.has(event as ProductEvent)
}

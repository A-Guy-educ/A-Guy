/**
 * System Events Analytics Subscriber
 *
 * Subscribes to the system event bus and maps events to analytics.track() calls.
 * This is the ONLY place where analytics.track() is called outside of tests.
 */

import type { SystemEventEnvelope, SystemEventName, Unsubscribe } from '@/infra/system-events'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { PRODUCT_EVENTS } from './contracts/events'
import { analytics } from './core/tracker'

let initialized = false
let cleanupFns: Unsubscribe[] = []

/**
 * Initialize analytics subscriber to the system event bus.
 * Maps all system events to analytics.track() calls.
 *
 * @returns Cleanup function that unsubscribes all handlers
 */
export function initAnalyticsSubscriber(): () => void {
  // Idempotent: only initialize once
  if (initialized) {
    console.warn('[Analytics] Subscriber already initialized, skipping')
    return () => cleanup()
  }
  initialized = true

  // Helper to wrap handlers with error isolation
  const safeSubscribe = (
    event: SystemEventName,
    handler: (envelope: SystemEventEnvelope<unknown>) => void,
  ): Unsubscribe => {
    return systemEventBus.on(event, (envelope) => {
      try {
        handler(envelope)
      } catch (error) {
        console.error(`[Analytics] Error handling ${event}:`, error)
        // Never throw - fail-safe
      }
    })
  }

  // Subscribe to all system events (10 core + 9 exercise)
  console.log('[Analytics] 🔄 Initializing system events subscriber...')
  cleanupFns = [
    // Page & Session
    safeSubscribe(SYSTEM_EVENTS.PAGE_VIEWED, (envelope) => {
      const payload = envelope.payload as {
        page_path?: string
        page_title?: string
        page_search?: string
        locale?: string
      }
      analytics.track(PRODUCT_EVENTS.PAGE_VIEW, {
        page_path: payload.page_path,
        page_title: payload.page_title,
        page_search: payload.page_search,
        locale: payload.locale,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.SESSION_STARTED, (envelope) => {
      const payload = envelope.payload as {
        session_id?: string
        is_anonymous?: boolean
        locale?: string
      }
      analytics.track(PRODUCT_EVENTS.SESSION_STARTED, {
        session_id: payload.session_id,
        is_anonymous: payload.is_anonymous,
        locale: payload.locale,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.USER_RESOLVED, (envelope) => {
      const payload = envelope.payload as { user_id?: string; auth_method?: string }
      // Map to USER_IDENTIFIED event
      analytics.track(PRODUCT_EVENTS.USER_IDENTIFIED, {
        user_id: payload.user_id,
        is_new_user: false,
      })
      // Also call identify for vendor SDKs
      if (payload.user_id) {
        analytics.identify(payload.user_id, {
          auth_method: payload.auth_method,
        })
      }
    }),

    // Course & Lesson Lifecycle
    safeSubscribe(SYSTEM_EVENTS.COURSE_ENTERED, (envelope) => {
      const payload = envelope.payload as {
        course_id?: string
        course_title?: string
        user_id?: string
      }
      analytics.track(PRODUCT_EVENTS.COURSE_ENTERED, {
        course_id: payload.course_id,
        course_title: payload.course_title,
        user_id: payload.user_id,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.LESSON_STARTED, (envelope) => {
      const payload = envelope.payload as {
        lesson_id?: string
        lesson_title?: string
        course_id?: string
        chapter_id?: string
        user_id?: string
      }
      analytics.track(PRODUCT_EVENTS.LESSON_STARTED, {
        lesson_id: payload.lesson_id,
        lesson_title: payload.lesson_title,
        course_id: payload.course_id,
        chapter_id: payload.chapter_id,
        user_id: payload.user_id,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.LESSON_ENDED, (envelope) => {
      const payload = envelope.payload as {
        lesson_id?: string
        course_id?: string
        duration_seconds?: number
        completion_percentage?: number
        user_id?: string
      }
      analytics.track(PRODUCT_EVENTS.LESSON_COMPLETED, {
        lesson_id: payload.lesson_id,
        course_id: payload.course_id,
        duration_seconds: payload.duration_seconds,
        completion_percentage: payload.completion_percentage,
        user_id: payload.user_id,
      })
    }),

    // Content Interaction
    safeSubscribe(SYSTEM_EVENTS.PDF_VIEWED, (envelope) => {
      const payload = envelope.payload as {
        pdf_url?: string
        pdf_title?: string
        page_count?: number
      }
      analytics.track(PRODUCT_EVENTS.PDF_VIEWED, {
        document_id: payload.pdf_url ?? 'unknown',
        file_name: payload.pdf_title,
        page_count: payload.page_count,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.CHAT_MESSAGE_SUBMITTED, (envelope) => {
      const payload = envelope.payload as {
        conversation_id?: string
        message_type?: 'user' | 'assistant'
        message_length?: number
        user_id?: string
      }
      console.log(`[Analytics] 📥 RECEIVED: CHAT_MESSAGE_SUBMITTED`, payload)
      analytics.track(PRODUCT_EVENTS.CHAT_MESSAGE_SENT, {
        conversation_id: payload.conversation_id,
        message_type: payload.message_type,
        message_length: payload.message_length,
        user_id: payload.user_id,
      })
    }),

    // Auth Gate
    safeSubscribe(SYSTEM_EVENTS.LOGIN_MODAL_SHOWN, (envelope) => {
      const payload = envelope.payload as {
        trigger_type?: string
        course_slug?: string
        current_page?: string
      }
      analytics.track(PRODUCT_EVENTS.LOGIN_MODAL_SHOWN, {
        trigger_type: payload.trigger_type,
        course_slug: payload.course_slug,
        current_page: payload.current_page,
      })
    }),

    // Registration Funnel
    safeSubscribe(SYSTEM_EVENTS.REGISTRATION_PROMPT_SHOWN, (envelope) => {
      const payload = envelope.payload as {
        prompt_location?: string
        trigger_reason?: string
        user_id?: string
      }
      analytics.track(PRODUCT_EVENTS.REGISTRATION_PROMPT_SHOWN, {
        prompt_location: payload.prompt_location,
        trigger_reason: payload.trigger_reason,
        user_id: payload.user_id,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.REGISTRATION_COMPLETED, (envelope) => {
      const payload = envelope.payload as {
        user_id?: string
        registration_method?: 'email' | 'social' | 'anonymous_upgrade'
      }
      analytics.track(PRODUCT_EVENTS.REGISTRATION_COMPLETED, {
        user_id: payload.user_id,
        registration_method: payload.registration_method,
      })
      // Alias anonymous user to registered user, THEN identify
      if (payload.user_id) {
        // CRITICAL: Call alias BEFORE identify to merge anonymous history
        analytics.alias(payload.user_id)
        analytics.identify(payload.user_id, {
          registration_method: payload.registration_method,
        })
      }
    }),

    // Exercise Help System Events
    safeSubscribe(SYSTEM_EVENTS.HINT_CLICKED, (envelope) => {
      const payload = envelope.payload as {
        lesson_id?: string
        exercise_id?: string
        question_id?: string
        hint_used?: boolean
        locale?: string
      }
      analytics.track(PRODUCT_EVENTS.HINT_CLICKED, {
        lesson_id: payload.lesson_id,
        exercise_id: payload.exercise_id,
        question_id: payload.question_id,
        hint_used: payload.hint_used,
        locale: payload.locale,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.GUIDING_QUESTION_CLICKED, (envelope) => {
      const payload = envelope.payload as {
        lesson_id?: string
        exercise_id?: string
        question_id?: string
        guiding_used?: boolean
        locale?: string
      }
      analytics.track(PRODUCT_EVENTS.GUIDING_QUESTION_CLICKED, {
        lesson_id: payload.lesson_id,
        exercise_id: payload.exercise_id,
        question_id: payload.question_id,
        guiding_used: payload.guiding_used,
        locale: payload.locale,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.SOLUTION_UNLOCKED, (envelope) => {
      const payload = envelope.payload as {
        lesson_id?: string
        exercise_id?: string
        question_id?: string
        hint_used?: boolean
        guiding_used?: boolean
        locale?: string
      }
      analytics.track(PRODUCT_EVENTS.SOLUTION_UNLOCKED, {
        lesson_id: payload.lesson_id,
        exercise_id: payload.exercise_id,
        question_id: payload.question_id,
        hint_used: payload.hint_used,
        guiding_used: payload.guiding_used,
        locale: payload.locale,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.SOLUTION_CLICKED, (envelope) => {
      const payload = envelope.payload as {
        lesson_id?: string
        exercise_id?: string
        question_id?: string
        hint_used?: boolean
        guiding_used?: boolean
        locale?: string
      }
      analytics.track(PRODUCT_EVENTS.SOLUTION_CLICKED, {
        lesson_id: payload.lesson_id,
        exercise_id: payload.exercise_id,
        question_id: payload.question_id,
        hint_used: payload.hint_used,
        guiding_used: payload.guiding_used,
        locale: payload.locale,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.STUDENT_ANSWER_SUBMITTED, (envelope) => {
      const payload = envelope.payload as {
        lesson_id?: string
        exercise_id?: string
        question_id?: string
        correctness?: boolean
        attempt_number?: number
        locale?: string
      }
      analytics.track(PRODUCT_EVENTS.STUDENT_ANSWER_SUBMITTED, {
        lesson_id: payload.lesson_id,
        exercise_id: payload.exercise_id,
        question_id: payload.question_id,
        correctness: payload.correctness,
        attempt_number: payload.attempt_number,
        locale: payload.locale,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.ANSWER_SELECTED, (envelope) => {
      const payload = envelope.payload as {
        lesson_id?: string
        exercise_id?: string
        question_id?: string
        selection_type?: string
        locale?: string
      }
      analytics.track(PRODUCT_EVENTS.ANSWER_SELECTED, {
        lesson_id: payload.lesson_id,
        exercise_id: payload.exercise_id,
        question_id: payload.question_id,
        selection_type: payload.selection_type,
        locale: payload.locale,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.CHAT_AUTO_TRIGGERED, (envelope) => {
      const payload = envelope.payload as {
        lesson_id?: string
        exercise_id?: string
        question_id?: string
        trigger_reason?: string
        locale?: string
      }
      analytics.track(PRODUCT_EVENTS.CHAT_AUTO_TRIGGERED, {
        lesson_id: payload.lesson_id,
        exercise_id: payload.exercise_id,
        question_id: payload.question_id,
        trigger_reason: payload.trigger_reason,
        locale: payload.locale,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.EXERCISE_VIEWED, (envelope) => {
      const payload = envelope.payload as {
        lesson_id?: string
        exercise_id?: string
        exercise_title?: string
        locale?: string
      }
      analytics.track(PRODUCT_EVENTS.EXERCISE_VIEWED, {
        lesson_id: payload.lesson_id,
        exercise_id: payload.exercise_id,
        exercise_title: payload.exercise_title,
        locale: payload.locale,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.EXERCISE_COMPLETED, (envelope) => {
      const payload = envelope.payload as {
        lesson_id?: string
        exercise_id?: string
        duration_seconds?: number
        total_questions?: number
        correct_count?: number
        locale?: string
      }
      analytics.track(PRODUCT_EVENTS.EXERCISE_COMPLETED, {
        lesson_id: payload.lesson_id,
        exercise_id: payload.exercise_id,
        duration_seconds: payload.duration_seconds,
        total_questions: payload.total_questions,
        correct_count: payload.correct_count,
        locale: payload.locale,
      })
    }),

    // Coupon & Access Events
    safeSubscribe(SYSTEM_EVENTS.COUPON_CODE_ENTERED, (envelope) => {
      const payload = envelope.payload as {
        coupon_code?: string
        lesson_id?: string
        course_id?: string
      }
      analytics.track(PRODUCT_EVENTS.COUPON_CODE_ENTERED, {
        coupon_code: payload.coupon_code,
        lesson_id: payload.lesson_id,
        course_id: payload.course_id,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.ACCESS_GATE_SHOWN, (envelope) => {
      const payload = envelope.payload as {
        gate_type?: 'free' | 'login' | 'paid' | 'coupon'
        lesson_id?: string
        course_id?: string
      }
      analytics.track(PRODUCT_EVENTS.ACCESS_GATE_SHOWN, {
        gate_type: payload.gate_type,
        lesson_id: payload.lesson_id,
        course_id: payload.course_id,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.ACCESS_GRANTED, (envelope) => {
      const payload = envelope.payload as {
        access_type?: 'free' | 'coupon' | 'paid'
        coupon_code?: string
        lesson_id?: string
        course_id?: string
      }
      analytics.track(PRODUCT_EVENTS.ACCESS_GRANTED, {
        access_type: payload.access_type,
        coupon_code: payload.coupon_code,
        lesson_id: payload.lesson_id,
        course_id: payload.course_id,
      })
    }),

    // Exercise Quality Events
    safeSubscribe(SYSTEM_EVENTS.ANSWER_CORRECT, (envelope) => {
      const payload = envelope.payload as {
        exercise_id?: string
        lesson_id?: string
        time_seconds?: number
        attempt_number?: number
        difficulty_level?: 'easy' | 'medium' | 'hard'
      }
      analytics.track(PRODUCT_EVENTS.ANSWER_CORRECT, {
        exercise_id: payload.exercise_id,
        lesson_id: payload.lesson_id,
        time_seconds: payload.time_seconds,
        attempt_number: payload.attempt_number,
        difficulty_level: payload.difficulty_level,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.ANSWER_INCORRECT, (envelope) => {
      const payload = envelope.payload as {
        exercise_id?: string
        lesson_id?: string
        attempt_number?: number
        max_attempts?: number
        time_seconds?: number
      }
      analytics.track(PRODUCT_EVENTS.ANSWER_INCORRECT, {
        exercise_id: payload.exercise_id,
        lesson_id: payload.lesson_id,
        attempt_number: payload.attempt_number,
        max_attempts: payload.max_attempts,
        time_seconds: payload.time_seconds,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.EXERCISE_SKIPPED, (envelope) => {
      const payload = envelope.payload as {
        exercise_id?: string
        lesson_id?: string
        reason?: string
      }
      analytics.track(PRODUCT_EVENTS.EXERCISE_SKIPPED, {
        exercise_id: payload.exercise_id,
        lesson_id: payload.lesson_id,
        reason: payload.reason,
      })
    }),

    // Engagement Signal Events
    safeSubscribe(SYSTEM_EVENTS.LESSON_ABANDONED, (envelope) => {
      const payload = envelope.payload as {
        lesson_id?: string
        course_id?: string
        time_spent_seconds?: number
        progress_percent?: number
        exercises_attempted?: number
        exercises_completed?: number
      }
      analytics.track(PRODUCT_EVENTS.LESSON_ABANDONED, {
        lesson_id: payload.lesson_id,
        course_id: payload.course_id,
        time_spent_seconds: payload.time_spent_seconds,
        progress_percent: payload.progress_percent,
        exercises_attempted: payload.exercises_attempted,
        exercises_completed: payload.exercises_completed,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.CHAPTER_COMPLETED, (envelope) => {
      const payload = envelope.payload as {
        course_id?: string
        chapter_id?: string
        total_lessons?: number
        completion_time_seconds?: number
      }
      analytics.track(PRODUCT_EVENTS.CHAPTER_COMPLETED, {
        course_id: payload.course_id,
        chapter_id: payload.chapter_id,
        total_lessons: payload.total_lessons,
        completion_time_seconds: payload.completion_time_seconds,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.TIME_ON_PAGE, (envelope) => {
      const payload = envelope.payload as {
        page_url?: string
        time_seconds?: number
        scroll_depth_percent?: number
        user_interacted?: boolean
      }
      analytics.track(PRODUCT_EVENTS.TIME_ON_PAGE, {
        page_url: payload.page_url,
        time_seconds: payload.time_seconds,
        scroll_depth_percent: payload.scroll_depth_percent,
        user_interacted: payload.user_interacted,
      })
    }),
  ]

  console.log(
    '[Analytics] ✅ System events subscriber initialized with',
    cleanupFns.length,
    'handlers',
  )

  return () => cleanup()
}

function cleanup(): void {
  cleanupFns.forEach((unsubscribe) => unsubscribe())
  cleanupFns = []
  initialized = false
}

// Re-export for convenience
export { SYSTEM_EVENTS } from '@/infra/system-events'

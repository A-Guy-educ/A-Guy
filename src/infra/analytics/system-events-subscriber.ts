/**
 * System Events Analytics Subscriber
 *
 * Subscribes to the system event bus and maps events to analytics.track() calls.
 * This is the ONLY place where analytics.track() is called outside of tests.
 */

import { analyticsConfig } from './config'
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
    if (analyticsConfig.debugMode) {
      console.warn('[Analytics] Subscriber already initialized, skipping')
    }
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
      } catch (_error) {
        // Never throw - fail-safe. console.error removed per spec NFR-001
      }
    })
  }

  // Subscribe to all 10 system events
  if (analyticsConfig.debugMode) {
    console.log('[Analytics] 🔄 Initializing system events subscriber...')
  }
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
        page_number?: number
        duration_seconds?: number
        user_id?: string
      }
      analytics.track(PRODUCT_EVENTS.PDF_VIEWED, {
        pdf_url: payload.pdf_url,
        pdf_title: payload.pdf_title,
        page_number: payload.page_number,
        duration_seconds: payload.duration_seconds,
        user_id: payload.user_id,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.CHAT_MESSAGE_SUBMITTED, (envelope) => {
      const payload = envelope.payload as {
        conversation_id?: string
        message_type?: 'user' | 'assistant'
        message_length?: number
        user_id?: string
      }
      if (analyticsConfig.debugMode) {
        console.log(`[Analytics] 📥 RECEIVED: CHAT_MESSAGE_SUBMITTED`, payload)
      }
      analytics.track(PRODUCT_EVENTS.CHAT_MESSAGE_SENT, {
        conversation_id: payload.conversation_id,
        message_type: payload.message_type,
        message_length: payload.message_length,
        user_id: payload.user_id,
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
  ]

  if (analyticsConfig.debugMode) {
    console.log(
      '[Analytics] ✅ System events subscriber initialized with',
      cleanupFns.length,
      'handlers',
    )
  }

  return () => cleanup()
}

function cleanup(): void {
  cleanupFns.forEach((unsubscribe) => unsubscribe())
  cleanupFns = []
  initialized = false
}

// Re-export for convenience
export { SYSTEM_EVENTS } from '@/infra/system-events'

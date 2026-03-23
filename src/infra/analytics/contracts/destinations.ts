/**
 * Event Routing Configuration
 *
 * Defines which analytics platform receives which events
 *
 * Tool Separation Strategy:
 * - GA4: Traffic, sessions, acquisition (broad funnel metrics)
 * - Mixpanel: Product behavior, retention, user journeys (detailed product analytics)
 */

import { PRODUCT_EVENTS, type ProductEvent } from './events'

export type AnalyticsDestination = 'ga4' | 'mixpanel'

/**
 * Event destination mapping
 *
 * Rule: Only send events to platforms where they provide value
 * - Both platforms: Page views, sessions, conversions (funnel visibility)
 * - Mixpanel only: Product interactions (detailed user behavior)
 */
export const eventDestinations: Record<ProductEvent, AnalyticsDestination[]> = {
  // Navigation & Session Events (both platforms for funnel visibility)
  [PRODUCT_EVENTS.PAGE_VIEW]: ['ga4', 'mixpanel'],
  [PRODUCT_EVENTS.SESSION_STARTED]: ['ga4', 'mixpanel'],
  [PRODUCT_EVENTS.SESSION_ENDED]: ['ga4', 'mixpanel'], // Session duration for both
  [PRODUCT_EVENTS.TAB_AWAY]: ['mixpanel'], // Product analytics - user left tab
  [PRODUCT_EVENTS.TAB_BACK]: ['mixpanel'], // Product analytics - user returned to tab

  // User Identity (Mixpanel only - for user journey stitching)
  [PRODUCT_EVENTS.USER_IDENTIFIED]: ['mixpanel'],

  // Course & Lesson Events (Mixpanel only - product analytics)
  [PRODUCT_EVENTS.COURSE_ENTERED]: ['mixpanel'],
  [PRODUCT_EVENTS.LESSON_STARTED]: ['mixpanel'],
  [PRODUCT_EVENTS.LESSON_COMPLETED]: ['mixpanel'],

  // Content Events (Mixpanel only - product analytics)
  [PRODUCT_EVENTS.PDF_VIEWED]: ['mixpanel'],
  [PRODUCT_EVENTS.CHAT_MESSAGE_SENT]: ['mixpanel'],

  // Auth Gate Events
  [PRODUCT_EVENTS.LOGIN_MODAL_SHOWN]: ['mixpanel'], // Product funnel - modal shown to anon user

  // Registration Events
  [PRODUCT_EVENTS.REGISTRATION_PROMPT_SHOWN]: ['mixpanel'], // Product funnel
  [PRODUCT_EVENTS.REGISTRATION_COMPLETED]: ['ga4', 'mixpanel'], // Conversion event (both)

  // Exercise Help System (Mixpanel only - detailed product analytics)
  [PRODUCT_EVENTS.HINT_CLICKED]: ['mixpanel'],
  [PRODUCT_EVENTS.GUIDING_QUESTION_CLICKED]: ['mixpanel'],
  [PRODUCT_EVENTS.SOLUTION_UNLOCKED]: ['mixpanel'],
  [PRODUCT_EVENTS.SOLUTION_CLICKED]: ['mixpanel'],
  [PRODUCT_EVENTS.STUDENT_ANSWER_SUBMITTED]: ['mixpanel'],
  [PRODUCT_EVENTS.ANSWER_SELECTED]: ['mixpanel'],
  [PRODUCT_EVENTS.CHAT_AUTO_TRIGGERED]: ['mixpanel'],
  [PRODUCT_EVENTS.EXERCISE_VIEWED]: ['mixpanel'],
  [PRODUCT_EVENTS.EXERCISE_COMPLETED]: ['mixpanel'],

  // Coupon & Access Events (Mixpanel only)
  [PRODUCT_EVENTS.COUPON_CODE_ENTERED]: ['mixpanel'],
  [PRODUCT_EVENTS.ACCESS_GATE_SHOWN]: ['mixpanel'],
  [PRODUCT_EVENTS.ACCESS_GRANTED]: ['mixpanel'],

  // Exercise Quality Events (Mixpanel only)
  [PRODUCT_EVENTS.ANSWER_CORRECT]: ['mixpanel'],
  [PRODUCT_EVENTS.ANSWER_INCORRECT]: ['mixpanel'],
  [PRODUCT_EVENTS.EXERCISE_SKIPPED]: ['mixpanel'],

  // Engagement Signal Events (Mixpanel only)
  [PRODUCT_EVENTS.LESSON_ABANDONED]: ['mixpanel'],
  [PRODUCT_EVENTS.CHAPTER_COMPLETED]: ['mixpanel'],
  [PRODUCT_EVENTS.TIME_ON_PAGE]: ['mixpanel'],
}

/**
 * Check if event should be sent to GA4
 */
export function shouldSendToGA4(event: ProductEvent): boolean {
  return eventDestinations[event].includes('ga4')
}

/**
 * Check if event should be sent to Mixpanel
 */
export function shouldSendToMixpanel(event: ProductEvent): boolean {
  return eventDestinations[event].includes('mixpanel')
}

/**
 * Get all destinations for an event
 */
export function getEventDestinations(event: ProductEvent): AnalyticsDestination[] {
  return eventDestinations[event]
}

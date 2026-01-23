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

  // User Identity (Mixpanel only - for user journey stitching)
  [PRODUCT_EVENTS.USER_IDENTIFIED]: ['mixpanel'],

  // Course & Lesson Events (Mixpanel only - product analytics)
  [PRODUCT_EVENTS.COURSE_ENTERED]: ['mixpanel'],
  [PRODUCT_EVENTS.LESSON_STARTED]: ['mixpanel'],
  [PRODUCT_EVENTS.LESSON_COMPLETED]: ['mixpanel'],

  // Content Events (Mixpanel only - product analytics)
  [PRODUCT_EVENTS.PDF_VIEWED]: ['mixpanel'],
  [PRODUCT_EVENTS.CHAT_MESSAGE_SENT]: ['mixpanel'],

  // Registration Events
  [PRODUCT_EVENTS.REGISTRATION_PROMPT_SHOWN]: ['mixpanel'], // Product funnel
  [PRODUCT_EVENTS.REGISTRATION_COMPLETED]: ['ga4', 'mixpanel'], // Conversion event (both)
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

/**
 * Analytics Public API
 *
 * This is the ONLY import path product code should use
 * Import from '@/lib/analytics' and nothing else
 */

// Core API
export { analytics, initializeAnalytics, getSessionId } from './core/tracker'

// Provider (for app initialization)
export { AnalyticsProvider } from './AnalyticsProvider'

// Event constants
export { PRODUCT_EVENTS } from './contracts/events'
export type { ProductEvent } from './contracts/events'

// TypeScript types
export type {
  PageViewProperties,
  SessionStartedProperties,
  UserIdentifiedProperties,
  CourseEnteredProperties,
  LessonStartedProperties,
  LessonCompletedProperties,
  PdfViewedProperties,
  ChatMessageSentProperties,
  RegistrationPromptShownProperties,
  RegistrationCompletedProperties,
} from './contracts/schemas'

// Configuration (for internal use)
export { analyticsConfig } from './config'

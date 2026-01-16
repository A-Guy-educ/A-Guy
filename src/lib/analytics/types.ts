/**
 * Shared TypeScript types for analytics system
 */

import type { ProductEvent } from './contracts/events'

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  enabled: boolean
  debugMode: boolean
  dryRun: boolean
  ga4: {
    measurementId: string | undefined
    enabled: boolean
  }
  mixpanel: {
    token: string | undefined
    enabled: boolean
  }
}

/**
 * Validation result
 */
export interface ValidationResult {
  success: boolean
  data?: Record<string, unknown>
  error?: {
    message: string
    issues?: Array<{
      path: string[]
      message: string
    }>
  }
}

/**
 * Track function signature
 */
export interface TrackFunction {
  (event: ProductEvent, properties?: Record<string, unknown>): void
}

/**
 * Identify function signature
 */
export interface IdentifyFunction {
  (userId: string, properties?: Record<string, unknown>): void
}

/**
 * Reset function signature
 */
export interface ResetFunction {
  (): void
}

/**
 * Analytics API
 */
export interface Analytics {
  track: TrackFunction
  identify: IdentifyFunction
  reset: ResetFunction
}

/**
 * Event payload (validated + enriched)
 */
export interface EventPayload {
  event: ProductEvent
  properties: Record<string, unknown>
  timestamp: string
  sessionId?: string
}

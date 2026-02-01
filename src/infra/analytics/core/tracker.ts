/**
 * Core Analytics Tracker
 *
 * Single entrypoint for all analytics tracking
 * Handles validation, routing, and platform adapters
 *
 * CRITICAL: This is the ONLY way product code should track events
 * No direct SDK calls allowed (no window.gtag or window.mixpanel)
 */

'use client'

import type { ProductEvent } from '../contracts/events'
import { getEventDestinations } from '../contracts/destinations'
import { analyticsConfig, validateConfig } from '../config'
import { validateEvent } from './validator'
import type { Analytics, EventPayload } from '../types'
import { clearCachedUserProperties } from '../utils/user-properties-cache'

// Adapters will be imported dynamically to avoid SSR issues
let ga4Adapter: typeof import('../adapters/ga4/adapter') | null = null
let mixpanelAdapter: typeof import('../adapters/mixpanel/adapter') | null = null

/**
 * Initialize adapters lazily (client-side only)
 */
async function initializeAdapters() {
  if (typeof window === 'undefined') return

  if (!ga4Adapter && analyticsConfig.ga4.enabled) {
    ga4Adapter = await import('../adapters/ga4/adapter')
  }

  if (!mixpanelAdapter && analyticsConfig.mixpanel.enabled) {
    mixpanelAdapter = await import('../adapters/mixpanel/adapter')
  }
}

/**
 * Get or create session ID
 * Uses sessionStorage for per-tab sessions
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  const SESSION_KEY = 'analytics_session_id'
  let sessionId = sessionStorage.getItem(SESSION_KEY)

  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem(SESSION_KEY, sessionId)
  }

  return sessionId
}

/**
 * Track an event
 *
 * @param event - Canonical event name
 * @param properties - Event properties (optional)
 */
export function track(event: ProductEvent, properties?: Record<string, unknown>): void {
  // Client-side only
  if (typeof window === 'undefined') {
    return
  }

  // Check if analytics is enabled
  if (!analyticsConfig.enabled) {
    if (analyticsConfig.debugMode) {
      console.log('[Analytics] Disabled:', event, properties)
    }
    return
  }

  try {
    // Validate event and properties
    const validation = validateEvent(event, properties)

    if (!validation.success) {
      // Validation failed - already logged in validator
      return
    }

    // Enrich with session data
    const payload: EventPayload = {
      event,
      properties: validation.data || {},
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    }

    // Debug mode - log event
    if (analyticsConfig.debugMode) {
      console.log('[Analytics] Track:', payload)
    }

    // Get destinations for this event
    const destinations = getEventDestinations(event)

    // Initialize adapters if needed
    void initializeAdapters().then(() => {
      // Send to GA4
      if (destinations.includes('ga4') && analyticsConfig.ga4.enabled && ga4Adapter) {
        ga4Adapter.sendToGA4(payload)
      }

      // Send to Mixpanel
      if (
        destinations.includes('mixpanel') &&
        analyticsConfig.mixpanel.enabled &&
        mixpanelAdapter
      ) {
        mixpanelAdapter.sendToMixpanel(payload)
      }
    })
  } catch (err) {
    // Never break user flows
    console.error('[Analytics] Track failed:', err)
  }
}

/**
 * Identify a user
 *
 * @param userId - User identifier
 * @param properties - User properties (optional, no PII)
 */
export function identify(userId: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (!analyticsConfig.enabled) return

  try {
    if (analyticsConfig.debugMode) {
      console.log('[Analytics] Identify:', { userId, properties })
    }

    void initializeAdapters().then(() => {
      // Only Mixpanel handles user identification
      if (analyticsConfig.mixpanel.enabled && mixpanelAdapter) {
        mixpanelAdapter.identifyUser(userId, properties)
      }
    })
  } catch (err) {
    console.error('[Analytics] Identify failed:', err)
  }
}

/**
 * Alias anonymous user to registered user
 *
 * CRITICAL: Call this BEFORE identify() during registration
 * to merge anonymous event history with the new user account
 *
 * @param userId - New user ID
 * @param anonymousId - Previous anonymous ID (optional - Mixpanel will use current distinct_id)
 */
export function alias(userId: string, anonymousId?: string): void {
  if (typeof window === 'undefined') return
  if (!analyticsConfig.enabled) return

  try {
    if (analyticsConfig.debugMode) {
      console.log('[Analytics] Alias:', { userId, anonymousId })
    }

    void initializeAdapters().then(() => {
      // Only Mixpanel handles aliasing
      if (analyticsConfig.mixpanel.enabled && mixpanelAdapter) {
        mixpanelAdapter.aliasUser(userId, anonymousId)
      }
    })
  } catch (err) {
    console.error('[Analytics] Alias failed:', err)
  }
}

/**
 * Reset user identity (on logout)
 */
export function reset(): void {
  if (typeof window === 'undefined') return
  if (!analyticsConfig.enabled) return

  try {
    if (analyticsConfig.debugMode) {
      console.log('[Analytics] Reset')
    }

    // Clear cached user properties
    clearCachedUserProperties()

    // Clear session tracking
    sessionStorage.removeItem('analytics_tracked_user_id')

    void initializeAdapters().then(() => {
      // Only Mixpanel handles user reset
      if (analyticsConfig.mixpanel.enabled && mixpanelAdapter) {
        mixpanelAdapter.resetUser()
      }
    })
  } catch (err) {
    console.error('[Analytics] Reset failed:', err)
  }
}

/**
 * Initialize analytics (call once on app start)
 */
export function initializeAnalytics(): void {
  if (typeof window === 'undefined') return

  validateConfig()

  if (analyticsConfig.debugMode) {
    console.log('[Analytics] Initialized')
  }
}

/**
 * Public analytics API
 */
export const analytics: Analytics = {
  track,
  identify,
  alias,
  reset,
}

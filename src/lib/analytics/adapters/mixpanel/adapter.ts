/**
 * Mixpanel Adapter
 *
 * Sends events to Mixpanel
 * Handles user identification and identity aliasing
 */

'use client'

import { analyticsConfig } from '../../config'
import type { EventPayload } from '../../types'
import { transformToMixpanel } from './transform'

/**
 * Declare Mixpanel global for TypeScript
 */
declare global {
  interface Window {
    mixpanel?: {
      init: (token: string, config?: Record<string, unknown>) => void
      track: (eventName: string, properties?: Record<string, unknown>) => void
      identify: (userId: string) => void
      alias: (userId: string, anonymousId?: string) => void
      reset: () => void
      people?: {
        set: (properties: Record<string, unknown>) => void
      }
      get_distinct_id: () => string
    }
  }
}

/**
 * Send event to Mixpanel
 *
 * @param payload - Event payload from tracker
 */
export function sendToMixpanel(payload: EventPayload): void {
  if (typeof window === 'undefined') return
  if (!analyticsConfig.mixpanel.enabled) return

  const { mixpanel } = window

  if (!mixpanel) {
    if (analyticsConfig.debugMode) {
      console.warn('[Analytics/Mixpanel] SDK not loaded')
    }
    return
  }

  try {
    // Transform canonical event to Mixpanel format
    const mixpanelEvent = transformToMixpanel(payload)

    // Send to Mixpanel
    mixpanel.track(mixpanelEvent.name, mixpanelEvent.properties)

    // Special handling for user_identified event
    // Also set user properties in Mixpanel People
    if (mixpanelEvent.name === 'user_identified' && mixpanel.people) {
      const userId = mixpanelEvent.properties.user_id as string

      if (userId) {
        // Identify user first
        mixpanel.identify(userId)

        // Extract user profile properties (exclude event metadata)
        const userProperties: Record<string, unknown> = {}
        const eventMetadataKeys = ['event_timestamp', 'session_id', '$current_url', '$referrer']

        Object.keys(mixpanelEvent.properties).forEach((key) => {
          if (!eventMetadataKeys.includes(key)) {
            userProperties[key] = mixpanelEvent.properties[key]
          }
        })

        // Set user properties in Mixpanel People
        // This creates the user profile in Mixpanel
        if (Object.keys(userProperties).length > 0) {
          mixpanel.people.set(userProperties)

          if (analyticsConfig.debugMode) {
            console.log('[Analytics/Mixpanel] People.set:', { userId, userProperties })
          }
        }
      }
    }

    if (analyticsConfig.debugMode) {
      console.log('[Analytics/Mixpanel] Sent:', mixpanelEvent)
    }
  } catch (err) {
    console.error('[Analytics/Mixpanel] Send failed:', err)
  }
}

/**
 * Identify user in Mixpanel
 *
 * @param userId - User identifier
 * @param properties - User properties (optional, no PII)
 */
export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (!analyticsConfig.mixpanel.enabled) return

  const { mixpanel } = window

  if (!mixpanel) {
    console.warn('[Analytics/Mixpanel] SDK not loaded')
    return
  }

  try {
    // Identify user
    mixpanel.identify(userId)

    // Set user properties if provided
    if (properties && mixpanel.people) {
      mixpanel.people.set(properties)
    }

    if (analyticsConfig.debugMode) {
      console.log('[Analytics/Mixpanel] Identified:', { userId, properties })
    }
  } catch (err) {
    console.error('[Analytics/Mixpanel] Identify failed:', err)
  }
}

/**
 * Alias anonymous user to registered user (for identity stitching)
 *
 * CRITICAL: This should only be called ONCE during registration
 * Call order: track('registration_completed') → alias() → identify()
 *
 * @param userId - New user ID
 * @param anonymousId - Previous anonymous ID (optional - Mixpanel will use current distinct_id)
 */
export function aliasUser(userId: string, anonymousId?: string): void {
  if (typeof window === 'undefined') return
  if (!analyticsConfig.mixpanel.enabled) return

  const { mixpanel } = window

  if (!mixpanel) {
    console.warn('[Analytics/Mixpanel] SDK not loaded')
    return
  }

  try {
    // Check if already aliased (prevent duplicate aliasing)
    const aliasedFlag = localStorage.getItem('mixpanel_aliased')
    if (aliasedFlag === 'true') {
      if (analyticsConfig.debugMode) {
        console.log('[Analytics/Mixpanel] Already aliased - skipping')
      }
      return
    }

    // Alias anonymous identity to user ID
    mixpanel.alias(userId, anonymousId)

    // Mark as aliased
    localStorage.setItem('mixpanel_aliased', 'true')

    if (analyticsConfig.debugMode) {
      console.log('[Analytics/Mixpanel] Aliased:', { userId, anonymousId })
    }
  } catch (err) {
    console.error('[Analytics/Mixpanel] Alias failed:', err)
  }
}

/**
 * Reset user identity (on logout)
 */
export function resetUser(): void {
  if (typeof window === 'undefined') return
  if (!analyticsConfig.mixpanel.enabled) return

  const { mixpanel } = window

  if (!mixpanel) {
    return
  }

  try {
    mixpanel.reset()

    // Clear aliased flag
    localStorage.removeItem('mixpanel_aliased')

    if (analyticsConfig.debugMode) {
      console.log('[Analytics/Mixpanel] Reset')
    }
  } catch (err) {
    console.error('[Analytics/Mixpanel] Reset failed:', err)
  }
}

/**
 * Get current anonymous/distinct ID
 */
export function getDistinctId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  if (!analyticsConfig.mixpanel.enabled) return undefined

  const { mixpanel } = window

  if (!mixpanel) return undefined

  try {
    return mixpanel.get_distinct_id()
  } catch (err) {
    console.error('[Analytics/Mixpanel] Get distinct ID failed:', err)
    return undefined
  }
}

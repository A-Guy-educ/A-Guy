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
import { clearAnonymousIdCookie, getOrCreateAnonymousId } from '../../utils/anonymous-id'

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
        set_once: (properties: Record<string, unknown>) => void
      }
      get_distinct_id: () => string
    }
  }
}

/**
 * Track if we've created a People profile for the current user
 */
let hasCreatedPeopleProfile = false

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

    // Create People profile on first event (for both anonymous and authenticated users)
    if (!hasCreatedPeopleProfile && mixpanel.people) {
      createPeopleProfile(mixpanel)
      hasCreatedPeopleProfile = true
    }

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
  } catch (_err) {
    // Silently fail - console.error removed per spec NFR-001
  }
}

/**
 * Create Mixpanel People profile for anonymous users
 *
 * @param mixpanel - Mixpanel instance
 */
function createPeopleProfile(mixpanel: NonNullable<typeof window.mixpanel>): void {
  if (!mixpanel.people) return

  try {
    const now = new Date().toISOString()

    // Set initial People properties
    const peopleProps: Record<string, unknown> = {
      $created: now,
      last_seen: now,
    }

    // Add browser/OS info if available from user agent
    if (navigator.userAgent) {
      // Simple browser detection
      const ua = navigator.userAgent
      if (ua.includes('Chrome')) peopleProps.$browser = 'Chrome'
      else if (ua.includes('Firefox')) peopleProps.$browser = 'Firefox'
      else if (ua.includes('Safari')) peopleProps.$browser = 'Safari'
      else if (ua.includes('Edge')) peopleProps.$browser = 'Edge'

      // Simple OS detection
      if (ua.includes('Windows')) peopleProps.$os = 'Windows'
      else if (ua.includes('Mac')) peopleProps.$os = 'macOS'
      else if (ua.includes('Linux')) peopleProps.$os = 'Linux'
      else if (ua.includes('Android')) peopleProps.$os = 'Android'
      else if (ua.includes('iOS')) peopleProps.$os = 'iOS'
    }

    // Add referrer info
    if (document.referrer) {
      peopleProps.initial_referrer = document.referrer
    }

    // Add landing page
    peopleProps.initial_landing_page = window.location.href

    // Set People properties (use set_once so we don't overwrite on subsequent visits)
    mixpanel.people.set_once(peopleProps)

    if (analyticsConfig.debugMode) {
      console.log('[Analytics/Mixpanel] People profile created:', peopleProps)
    }
  } catch (_err) {
    // Silently fail - console.error removed per spec NFR-001
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
    if (analyticsConfig.debugMode) {
      console.warn('[Analytics/Mixpanel] SDK not loaded')
    }
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
  } catch (_err) {
    // Silently fail - console.error removed per spec NFR-001
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
    if (analyticsConfig.debugMode) {
      console.warn('[Analytics/Mixpanel] SDK not loaded')
    }
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
  } catch (_err) {
    // Silently fail - console.error removed per spec NFR-001
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
    // Reset Mixpanel SDK state
    mixpanel.reset()

    // Clear aliased flag
    localStorage.removeItem('mixpanel_aliased')

    // Clear anonymous ID cookie so a new one is generated
    clearAnonymousIdCookie()

    // Reset People profile flag
    hasCreatedPeopleProfile = false

    // Generate new anonymous ID and identify with it
    const newAnonymousId = getOrCreateAnonymousId()
    mixpanel.identify(newAnonymousId)

    if (analyticsConfig.debugMode) {
      console.log('[Analytics/Mixpanel] Reset with new anonymous ID:', newAnonymousId)
    }
  } catch (_err) {
    // Silently fail - console.error removed per spec NFR-001
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
  } catch (_err) {
    // Silently fail - console.error removed per spec NFR-001
    return undefined
  }
}

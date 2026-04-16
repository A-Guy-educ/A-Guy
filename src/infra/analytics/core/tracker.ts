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

// Track whether adapters have been initialized
let adaptersInitialized = false

// In-memory event queue for events fired before adapters are ready
// Max 100 events to prevent memory issues
const MAX_QUEUE_SIZE = 100
const eventQueue: EventPayload[] = []

/**
 * Eagerly initialize adapters once (client-side only).
 * Uses a singleton promise so concurrent callers share the same initialization.
 * Sets adaptersInitialized = true when done so queued events are sent immediately.
 */
let initializationPromise: Promise<void> | null = null

function getInitializationPromise(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (initializationPromise) return initializationPromise

  initializationPromise = doInitializeAdapters().then(() => {
    adaptersInitialized = true
    flushEventQueue()
  })

  return initializationPromise
}

async function doInitializeAdapters(): Promise<void> {
  const initFns: Promise<void>[] = []

  if (analyticsConfig.ga4.enabled) {
    initFns.push(
      import('../adapters/ga4/adapter')
        .then((m) => {
          ga4Adapter = m
        })
        .catch((err) => {
          console.error('[Analytics] GA4 adapter init failed:', err)
        }),
    )
  }

  if (analyticsConfig.mixpanel.enabled) {
    initFns.push(
      import('../adapters/mixpanel/adapter')
        .then((m) => {
          mixpanelAdapter = m
        })
        .catch((err) => {
          console.error('[Analytics] Mixpanel adapter init failed:', err)
        }),
    )
  }

  await Promise.all(initFns)
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
 * Build a standardized event payload with enrichment.
 */
function buildPayload(event: ProductEvent, properties: Record<string, unknown>): EventPayload {
  return {
    event,
    properties,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
  }
}

/**
 * Queue an event for delivery.
 * If adapters are initialized, sends immediately. Otherwise, queues it.
 */
function queueOrSend(payload: EventPayload, destinations: string[]): void {
  if (adaptersInitialized) {
    sendToDestinations(payload, destinations)
  } else {
    if (eventQueue.length < MAX_QUEUE_SIZE) {
      eventQueue.push(payload)
    }
    void getInitializationPromise()
  }
}

/**
 * Flush all queued events to their destinations.
 * Called once when adapters finish initializing.
 */
function flushEventQueue(): void {
  const queue = eventQueue.splice(0, eventQueue.length)
  if (queue.length === 0) return

  for (const payload of queue) {
    const dests = getEventDestinations(payload.event)
    sendToDestinations(payload, dests)
  }
}

/**
 * Send a payload to configured destinations.
 */
function sendToDestinations(payload: EventPayload, destinations: string[]): void {
  if (destinations.includes('ga4') && analyticsConfig.ga4.enabled && ga4Adapter) {
    ga4Adapter.sendToGA4(payload)
  }

  if (destinations.includes('mixpanel') && analyticsConfig.mixpanel.enabled && mixpanelAdapter) {
    mixpanelAdapter.sendToMixpanel(payload)
  }
}

function sendIdentify(userId: string, properties?: Record<string, unknown>): void {
  if (analyticsConfig.mixpanel.enabled && mixpanelAdapter) {
    mixpanelAdapter.identifyUser(userId, properties)
  }
}

function sendAlias(userId: string, anonymousId?: string): void {
  if (analyticsConfig.mixpanel.enabled && mixpanelAdapter) {
    mixpanelAdapter.aliasUser(userId, anonymousId)
  }
}

function sendReset(): void {
  if (analyticsConfig.mixpanel.enabled && mixpanelAdapter) {
    mixpanelAdapter.resetUser()
  }
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
    const payload = buildPayload(event, validation.data || {})

    // Debug mode - log event
    if (analyticsConfig.debugMode) {
      console.log('[Analytics] Track:', payload)
    }

    // Get destinations for this event
    const destinations = getEventDestinations(event)

    // Queue or send immediately
    queueOrSend(payload, destinations)
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

    // Ensure adapters are initialized before identifying
    void getInitializationPromise().then(() => {
      sendIdentify(userId, properties)
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

    // Ensure adapters are initialized before aliasing
    void getInitializationPromise().then(() => {
      sendAlias(userId, anonymousId)
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

    void getInitializationPromise().then(() => {
      sendReset()
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

  // Trigger eager adapter initialization (non-blocking)
  void getInitializationPromise()
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

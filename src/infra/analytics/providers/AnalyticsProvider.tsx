/**
 * Analytics Provider
 *
 * Provides analytics context to the entire app
 * Loads analytics scripts and initializes the system
 */

'use client'

import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { GA4Scripts } from '../adapters/ga4/scripts'
import { MixpanelScripts } from '../adapters/mixpanel/scripts'
import { UserIdentificationTracker } from '../components/UserIdentificationTracker'
import { analyticsConfig } from '../config'
import { analytics, getSessionId, initializeAnalytics } from '../index'
import { usePageView } from '../hooks/usePageView'
import { useSessionDuration } from '../hooks/useSessionDuration'
import { usePageAbandonment } from '../hooks/usePageAbandonment'
import { initAnalyticsSubscriber } from '../system-events-subscriber'
import type { Analytics } from '../types'

/**
 * Analytics context
 */
const AnalyticsContext = createContext<Analytics>(analytics)

/**
 * Analytics Provider Props
 */
interface AnalyticsProviderProps {
  children: ReactNode
}

/**
 * Analytics Provider Component
 *
 * Must wrap the app to provide analytics functionality
 * Handles script loading and initialization
 */
export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  // Initialize analytics and subscribe to system events synchronously
  // This must happen BEFORE any children render to prevent race conditions
  // where usePageView fires before handlers are registered
  useEffect(() => {
    // Initialize analytics core
    initializeAnalytics()

    // Initialize system events subscriber (analytics integration)
    const cleanupSubscriber = initAnalyticsSubscriber()

    // Track session_started once per session via system event bus
    const sessionStartedKey = 'system_events_session_started'
    const sessionStarted = sessionStorage.getItem(sessionStartedKey)

    if (!sessionStarted && analyticsConfig.enabled) {
      // getSessionId() creates the session ID if it doesn't exist
      const sessionId = getSessionId()
      systemEventBus.emit(SYSTEM_EVENTS.SESSION_STARTED, {
        session_id: sessionId,
        is_anonymous: true, // Will be updated on user_resolved
      })

      sessionStorage.setItem(sessionStartedKey, 'true')
    }

    return () => {
      cleanupSubscriber()
    }
  }, [])

  return (
    <AnalyticsContext.Provider value={analytics}>
      {/* Initialize subscriber synchronously before children effects run */}
      <SubscriberInitializer />
      {/* Load analytics scripts */}
      <GA4Scripts />
      <MixpanelScripts />

      {/* Track user identification */}
      <UserIdentificationTracker />

      {/* Track page views, session duration, and page abandonment */}
      <AnalyticsHooks />

      {/* Render children */}
      {children}
    </AnalyticsContext.Provider>
  )
}

/**
 * Synchronous subscriber initializer
 * Registers handlers IMMEDIATELY on mount, before any child effects run
 * This ensures events emitted during render or in child useEffects are captured
 * CRITICAL: Must be rendered BEFORE any component that uses usePageView
 */
function SubscriberInitializer() {
  // Register handlers synchronously - this must happen before any usePageView effects
  initAnalyticsSubscriber()
  return null
}

/**
 * Analytics Hooks
 * Runs page view, session duration, and page abandonment tracking hooks.
 * Rendered inside the provider so hooks activate after scripts and subscriber are ready.
 */
function AnalyticsHooks() {
  usePageView()
  useSessionDuration()
  usePageAbandonment()
  return null
}

/**
 * Hook to access analytics
 *
 * @returns Analytics API
 *
 * @example
 * ```tsx
 * const analytics = useAnalytics()
 * analytics.track(PRODUCT_EVENTS.LESSON_STARTED, { lesson_id: '123' })
 * ```
 */
export function useAnalytics(): Analytics {
  const context = useContext(AnalyticsContext)

  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider')
  }

  return context
}

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
  useEffect(() => {
    // Initialize analytics on mount
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
      {/* Load analytics scripts */}
      <GA4Scripts />
      <MixpanelScripts />

      {/* Track user identification */}
      <UserIdentificationTracker />

      {/* Render children */}
      {children}
    </AnalyticsContext.Provider>
  )
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

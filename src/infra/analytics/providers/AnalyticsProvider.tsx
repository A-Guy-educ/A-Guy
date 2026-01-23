/**
 * Analytics Provider
 *
 * Provides analytics context to the entire app
 * Loads analytics scripts and initializes the system
 */

'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { analytics, initializeAnalytics, getSessionId, PRODUCT_EVENTS } from '../index'
import { GA4Scripts } from '../adapters/ga4/scripts'
import { MixpanelScripts } from '../adapters/mixpanel/scripts'
import { analyticsConfig } from '../config'
import type { Analytics } from '../types'
import { UserIdentificationTracker } from '../components/UserIdentificationTracker'

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

    // Track session_started once per session
    const sessionStartedKey = 'analytics_session_started'
    const sessionStarted = sessionStorage.getItem(sessionStartedKey)

    if (!sessionStarted && analyticsConfig.enabled) {
      // getSessionId() creates the session ID if it doesn't exist
      const sessionId = getSessionId()
      analytics.track(PRODUCT_EVENTS.SESSION_STARTED, {
        session_id: sessionId,
        is_anonymous: true, // Will be updated on user_identified
      })

      sessionStorage.setItem(sessionStartedKey, 'true')
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

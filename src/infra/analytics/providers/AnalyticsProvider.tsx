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
  // Single initialization effect — runs once on mount, before child effects
  useEffect(() => {
    initializeAnalytics()
    const cleanupSubscriber = initAnalyticsSubscriber()

    // Expose internals on window for E2E testing only
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__systemEventBus = systemEventBus
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__capturedMixpanelEvents = []

    // Emit session_started once per session
    const sessionStartedKey = 'system_events_session_started'
    if (!sessionStorage.getItem(sessionStartedKey) && analyticsConfig.enabled) {
      systemEventBus.emit(SYSTEM_EVENTS.SESSION_STARTED, {
        session_id: getSessionId(),
        is_anonymous: true,
      })
      sessionStorage.setItem(sessionStartedKey, 'true')
    }

    return () => {
      // Clean up test exposure on unmount
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__systemEventBus
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__capturedMixpanelEvents
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

      {/* Track page views, session duration, and page abandonment */}
      <AnalyticsHooks />

      {/* Render children */}
      {children}
    </AnalyticsContext.Provider>
  )
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

  // Patch mixpanel.track to capture events for E2E testing
  useEffect(() => {
    const interval = setInterval(() => {
      const mp = (window as unknown as Record<string, unknown>).mixpanel as
        | {
            track?: (event: string, props?: Record<string, unknown>) => void
          }
        | undefined
      if (mp?.track && !(mp.track as unknown as { __captured?: boolean }).__captured) {
        const originalTrack = mp.track.bind(mp)
        ;(mp.track as unknown as { __captured?: boolean }).__captured = true
        mp.track = (event, properties) => {
          originalTrack(event, properties)
          // Push to shared capture array for E2E tests
          const captured = (window as unknown as Record<string, unknown>)
            .__capturedMixpanelEvents as
            | Array<{ event: string; properties: Record<string, unknown> }>
            | undefined
          captured?.push({ event, properties: properties || {} })
        }
        clearInterval(interval)
      }
    }, 200)

    return () => clearInterval(interval)
  }, [])

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

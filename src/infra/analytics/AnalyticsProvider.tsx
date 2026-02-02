/**
 * Analytics Provider
 *
 * Subscribes to system events and initializes analytics tracking.
 * Keeps analytics concerns separate from UI components.
 *
 * This component should be included in the root layout to enable analytics.
 */

'use client'

import { useEffect, useState } from 'react'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { usePageView } from './hooks/usePageView'
import { useSessionDuration } from './hooks/useSessionDuration'
import { usePageAbandonment } from './hooks/usePageAbandonment'

/**
 * Analytics Initializer (internal component)
 * Calls all analytics hooks. Only rendered after SITE_INIT.
 */
function AnalyticsInitializer() {
  // Track page views automatically on route changes
  usePageView()

  // Track session duration and end events
  useSessionDuration()

  // Track page abandonment and visibility changes
  usePageAbandonment()

  return null
}

export function AnalyticsProvider() {
  const [initialized, setInitialized] = useState(false)

  // Subscribe to SITE_INIT event
  useEffect(() => {
    const unsubscribe = systemEventBus.on(SYSTEM_EVENTS.SITE_INIT, () => {
      setInitialized(true)
    })

    return unsubscribe
  }, [])

  // Only render analytics initializer after SITE_INIT event
  if (!initialized) {
    return null
  }

  return <AnalyticsInitializer />
}

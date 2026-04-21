/**
 * Session Duration Tracker
 *
 * Tracks total session duration and sends session_ended event when user leaves.
 * Uses beforeunload event to capture when user closes tab/window or navigates away.
 *
 * Reliability: Sends session_ended via both analytics.track() (for GA4) and
 * navigator.sendBeacon directly to Mixpanel (guaranteed even on page unload).
 * This dual-delivery ensures Mixpanel receives the event regardless of timing.
 */

'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { analytics, getSessionId } from '../index'
import { PRODUCT_EVENTS } from '../contracts/events'
import { analyticsConfig } from '../config'

export function useSessionDuration() {
  const sessionStartTime = useRef<number>(Date.now())
  const pageViewCount = useRef<number>(0)
  const lastActivePage = useRef<string>('')
  const pathname = usePathname()

  useEffect(() => {
    // Track page view count
    pageViewCount.current += 1
    lastActivePage.current = pathname

    // Track session end on beforeunload
    const handleBeforeUnload = () => {
      const durationSeconds = Math.floor((Date.now() - sessionStartTime.current) / 1000)
      const sessionId = getSessionId()

      // Primary: send via analytics.track() (routes to GA4 and Mixpanel SDK)
      try {
        analytics.track(PRODUCT_EVENTS.SESSION_ENDED, {
          session_id: sessionId,
          duration_seconds: durationSeconds,
          page_views_count: pageViewCount.current,
          last_active_page: lastActivePage.current,
        })
      } catch {
        // Silently fail - don't block page unload
      }

      // Fallback: send directly via sendBeacon to Mixpanel
      // This is non-blocking and browsers prioritize sendBeacon during unload
      sendSessionEndedViaBeacon(sessionId, durationSeconds)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [pathname])
}

/**
 * Send session_ended directly to Mixpanel via sendBeacon.
 * This is a fire-and-forget fallback — the browser handles retry-free delivery.
 */
function sendSessionEndedViaBeacon(sessionId: string, durationSeconds: number): void {
  if (typeof navigator === 'undefined' || !analyticsConfig.mixpanel.enabled) return

  const token = analyticsConfig.mixpanel.token
  if (!token) return

  const payload = {
    event: PRODUCT_EVENTS.SESSION_ENDED,
    properties: {
      token,
      session_id: sessionId,
      duration_seconds: durationSeconds,
      $insert_id: `session_end_${sessionId}_${Date.now()}`,
      time: Math.floor(Date.now() / 1000),
    },
  }

  try {
    const blob = new Blob([JSON.stringify([payload])], { type: 'application/json' })
    navigator.sendBeacon('https://api.mixpanel.com/track', blob)
  } catch {
    // Silently fail — primary track() call already attempted
  }
}

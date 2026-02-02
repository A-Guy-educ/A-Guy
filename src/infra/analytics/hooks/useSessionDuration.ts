/**
 * Session Duration Tracker
 *
 * Tracks total session duration and sends session_ended event when user leaves.
 * Uses beforeunload event to capture when user closes tab/window or navigates away.
 */

'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { analytics, getSessionId } from '../index'
import { PRODUCT_EVENTS } from '../contracts/events'

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

      // Send session ended event
      try {
        analytics.track(PRODUCT_EVENTS.SESSION_ENDED, {
          session_id: getSessionId(),
          duration_seconds: durationSeconds,
          page_views_count: pageViewCount.current,
          last_active_page: lastActivePage.current,
        })
      } catch (error) {
        // Silently fail - don't block page unload
        if (process.env.NODE_ENV === 'development') {
          console.error('[Analytics] Failed to track session_ended:', error)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [pathname])
}

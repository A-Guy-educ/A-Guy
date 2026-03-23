/**
 * Tab Visibility Tracker
 *
 * Tracks when users switch away from and back to the tab.
 * Measures time on page and scroll depth.
 *
 * Events:
 * - tab_away: User switched to another tab/minimized (includes scroll depth)
 * - tab_back: User returned to the tab
 */

'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { analytics } from '../index'
import { PRODUCT_EVENTS } from '../contracts/events'

export function usePageAbandonment() {
  const pathname = usePathname()
  const pageStartTime = useRef<number>(Date.now())
  const maxScroll = useRef<number>(0)
  const lastScrollUpdate = useRef<number>(0)

  useEffect(() => {
    // Reset timer on page change
    pageStartTime.current = Date.now()
    maxScroll.current = 0
    lastScrollUpdate.current = 0

    // Track scroll depth (throttled to avoid excessive events)
    const handleScroll = () => {
      const now = Date.now()
      if (now - lastScrollUpdate.current < 1000) return

      lastScrollUpdate.current = now

      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const scrollTop = window.scrollY

      const scrollPercent = Math.round((scrollTop / (documentHeight - windowHeight)) * 100)
      maxScroll.current = Math.max(maxScroll.current, scrollPercent || 0)
    }

    const handleVisibilityChange = () => {
      const timeOnPage = Math.floor((Date.now() - pageStartTime.current) / 1000)

      try {
        if (document.visibilityState === 'hidden') {
          analytics.track(PRODUCT_EVENTS.TAB_AWAY, {
            page_url: pathname,
            time_on_page_seconds: timeOnPage,
            scroll_depth_percent: maxScroll.current,
          })
        } else {
          analytics.track(PRODUCT_EVENTS.TAB_BACK, {
            page_url: pathname,
            time_on_page_seconds: timeOnPage,
          })
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Analytics] Failed to track tab visibility:', error)
        }
      }
    }

    // Time-on-page threshold tracking
    const TIME_THRESHOLDS = [30, 60, 120, 300, 600]
    let lastFiredThreshold = 0

    const checkTimeThreshold = () => {
      const timeOnPage = Math.floor((Date.now() - pageStartTime.current) / 1000)

      for (const threshold of TIME_THRESHOLDS) {
        if (timeOnPage >= threshold && lastFiredThreshold < threshold) {
          try {
            analytics.track(PRODUCT_EVENTS.TIME_ON_PAGE, {
              page_url: pathname,
              time_seconds: threshold,
              scroll_depth_percent: maxScroll.current,
              user_interacted: maxScroll.current > 0,
            })
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('[Analytics] Failed to track time_on_page:', error)
            }
          }
          lastFiredThreshold = threshold
        }
      }
    }

    const intervalId = setInterval(checkTimeThreshold, 1000)

    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pathname])
}

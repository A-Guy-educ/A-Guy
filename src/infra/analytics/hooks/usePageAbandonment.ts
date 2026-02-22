/**
 * Page Abandonment Tracker
 *
 * Tracks when users leave a page and measures:
 * - Time spent on page
 * - Scroll depth (how far they scrolled)
 * - Tab visibility changes (switching tabs)
 *
 * Uses Page Visibility API to detect when user switches tabs or minimizes window.
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
      // Throttle to max 1 update per second
      if (now - lastScrollUpdate.current < 1000) return

      lastScrollUpdate.current = now

      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const scrollTop = window.scrollY

      // Calculate scroll percentage
      const scrollPercent = Math.round((scrollTop / (documentHeight - windowHeight)) * 100)

      // Track max scroll reached (never goes down)
      maxScroll.current = Math.max(maxScroll.current, scrollPercent || 0)
    }

    // Track visibility changes (tab switching)
    const handleVisibilityChange = () => {
      const timeOnPage = Math.floor((Date.now() - pageStartTime.current) / 1000)

      try {
        // Track visibility state change
        analytics.track(PRODUCT_EVENTS.VISIBILITY_CHANGED, {
          visibility_state: document.visibilityState as 'visible' | 'hidden',
          time_on_page_seconds: timeOnPage,
        })

        // If user is leaving the tab, track as potential abandonment
        if (document.visibilityState === 'hidden') {
          analytics.track(PRODUCT_EVENTS.PAGE_ABANDONED, {
            page_url: pathname,
            time_on_page_seconds: timeOnPage,
            scroll_depth_percent: maxScroll.current,
          })
        }
      } catch (_error) {
        // Silently fail - don't break user experience. console.error removed per spec NFR-001
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pathname])
}

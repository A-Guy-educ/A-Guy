/**
 * Page View Tracking Hook
 *
 * Automatically tracks page views on route changes
 * CRITICAL: Should only be used in ONE place (app layout) to avoid duplicates
 */

'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { PRODUCT_EVENTS } from '../contracts/events'
import { useAnalytics } from '../providers/AnalyticsProvider'

/**
 * Hook to automatically track page views
 *
 * Usage:
 * ```tsx
 * // In app layout ONLY
 * export default function RootLayout({ children }) {
 *   usePageView() // Tracks page views automatically
 *   return <>{children}</>
 * }
 * ```
 *
 * DO NOT use in multiple components - will cause duplicate events
 */
export function usePageView() {
  const analytics = useAnalytics()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Track page view on route change
    analytics.track(PRODUCT_EVENTS.PAGE_VIEW, {
      page_path: pathname,
      page_search: searchParams.toString(),
      page_title: typeof document !== 'undefined' ? document.title : undefined,
    })
  }, [pathname, searchParams, analytics])
}

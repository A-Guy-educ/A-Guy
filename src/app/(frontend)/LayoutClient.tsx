/**
 * Frontend Layout Client Component
 *
 * Handles client-side concerns for the frontend layout
 * CRITICAL: Only place for page view tracking (avoid duplicates)
 */

'use client'

import { usePageView } from '@/lib/analytics/hooks/usePageView'

export function LayoutClient() {
  // Track page views automatically on route changes
  // This is the ONLY place page_view should be tracked
  usePageView()

  return null
}

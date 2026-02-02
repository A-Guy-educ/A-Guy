/**
 * Frontend Layout Client Component
 *
 * Handles client-side concerns for the frontend layout
 * CRITICAL: Only place for analytics tracking hooks (avoid duplicates)
 */

'use client'

import { usePageView } from '@/infra/analytics/hooks/usePageView'
import { useSessionDuration } from '@/infra/analytics/hooks/useSessionDuration'
import { usePageAbandonment } from '@/infra/analytics/hooks/usePageAbandonment'

export function LayoutClient() {
  // Track page views automatically on route changes
  usePageView()

  // Track session duration and end events
  useSessionDuration()

  // Track page abandonment and visibility changes
  usePageAbandonment()

  return null
}

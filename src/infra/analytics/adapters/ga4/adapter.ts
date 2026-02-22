/**
 * Google Analytics 4 (GA4) Adapter
 *
 * Sends events to GA4 via gtag.js
 * Handles event transformation and format conversion
 */

'use client'

import { analyticsConfig } from '../../config'
import type { EventPayload } from '../../types'
import { transformToGA4 } from './transform'

/**
 * Declare gtag global for TypeScript
 */
declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      config?: Record<string, unknown>,
    ) => void
    dataLayer?: unknown[]
  }
}

/**
 * Send event to GA4
 *
 * @param payload - Event payload from tracker
 */
export function sendToGA4(payload: EventPayload): void {
  if (typeof window === 'undefined') return
  if (!analyticsConfig.ga4.enabled) return

  const { gtag } = window

  if (!gtag) {
    if (analyticsConfig.debugMode) {
      console.warn('[Analytics/GA4] gtag not loaded')
    }
    return
  }

  try {
    // Transform canonical event to GA4 format
    const ga4Event = transformToGA4(payload)

    // Send to GA4
    gtag('event', ga4Event.name, ga4Event.params)

    if (analyticsConfig.debugMode) {
      console.log('[Analytics/GA4] Sent:', ga4Event)
    }
  } catch (_err) {
    // Silently fail - console.error removed per spec NFR-001
  }
}

/**
 * Initialize GA4 (called by script loader)
 */
export function initializeGA4(): void {
  if (typeof window === 'undefined') return
  if (!analyticsConfig.ga4.enabled) return

  const measurementId = analyticsConfig.ga4.measurementId

  if (!measurementId) {
    // No measurement ID configured - console.error removed per spec NFR-001
    return
  }

  const { gtag } = window

  if (!gtag) {
    // gtag not available - console.error removed per spec NFR-001
    return
  }

  try {
    // Initialize dataLayer
    window.dataLayer = window.dataLayer || []

    // Configure GA4
    gtag('js', new Date())
    gtag('config', measurementId, {
      send_page_view: false, // We handle page views manually
    })

    if (analyticsConfig.debugMode) {
      console.log('[Analytics/GA4] Initialized:', measurementId)
    }
  } catch (_err) {
    // Silently fail - console.error removed per spec NFR-001
  }
}

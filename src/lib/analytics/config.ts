/**
 * Analytics Configuration
 *
 * Environment-based configuration for analytics system
 * All settings controlled via environment variables
 */

import type { AnalyticsConfig } from './types'

/**
 * Get analytics configuration from environment variables
 *
 * Feature flags:
 * - NEXT_PUBLIC_ANALYTICS_ENABLED: Master switch
 * - NEXT_PUBLIC_ANALYTICS_DEBUG: Log events to console
 * - NEXT_PUBLIC_ANALYTICS_DRY_RUN: Log without sending to platforms
 * - NEXT_PUBLIC_GA4_ENABLED: Enable GA4
 * - NEXT_PUBLIC_MIXPANEL_ENABLED: Enable Mixpanel
 */
export function getAnalyticsConfig(): AnalyticsConfig {
  const isClient = typeof window !== 'undefined'

  // Only initialize on client-side
  if (!isClient) {
    return {
      enabled: false,
      debugMode: false,
      dryRun: false,
      ga4: { measurementId: undefined, enabled: false },
      mixpanel: { token: undefined, enabled: false },
    }
  }

  const enabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'
  const debugMode = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true'
  const dryRun = process.env.NEXT_PUBLIC_ANALYTICS_DRY_RUN === 'true'

  const ga4MeasurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
  const ga4Enabled = process.env.NEXT_PUBLIC_GA4_ENABLED === 'true' && !!ga4MeasurementId

  const mixpanelToken = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN
  const mixpanelEnabled = process.env.NEXT_PUBLIC_MIXPANEL_ENABLED === 'true' && !!mixpanelToken

  return {
    enabled,
    debugMode,
    dryRun,
    ga4: {
      measurementId: ga4MeasurementId,
      enabled: enabled && ga4Enabled,
    },
    mixpanel: {
      token: mixpanelToken,
      enabled: enabled && mixpanelEnabled,
    },
  }
}

/**
 * Singleton config instance
 */
export const analyticsConfig = getAnalyticsConfig()

/**
 * Validate configuration (call before first use)
 */
export function validateConfig(): void {
  if (!analyticsConfig.enabled) {
    if (analyticsConfig.debugMode) {
      console.log('[Analytics] Disabled via NEXT_PUBLIC_ANALYTICS_ENABLED')
    }
    return
  }

  if (analyticsConfig.dryRun) {
    console.log('[Analytics] Dry-run mode enabled - events will be logged but not sent')
  }

  if (!analyticsConfig.ga4.enabled && !analyticsConfig.mixpanel.enabled) {
    console.warn('[Analytics] Enabled but no platforms configured (GA4 and Mixpanel both disabled)')
  }

  if (analyticsConfig.debugMode) {
    console.log('[Analytics] Configuration:', {
      enabled: analyticsConfig.enabled,
      dryRun: analyticsConfig.dryRun,
      ga4Enabled: analyticsConfig.ga4.enabled,
      mixpanelEnabled: analyticsConfig.mixpanel.enabled,
    })
  }
}

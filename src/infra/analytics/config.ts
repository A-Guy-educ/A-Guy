/**
 * Analytics Configuration
 *
 * Environment-based configuration for analytics system
 * Simplified: presence of token/key enables the platform
 */

import type { AnalyticsConfig } from './types'

/**
 * Get analytics configuration from environment variables
 *
 * Simple rule: If a token/key is set, that platform is enabled
 * - NEXT_PUBLIC_GA4_MEASUREMENT_ID: Enables GA4
 * - NEXT_PUBLIC_MIXPANEL_TOKEN: Enables Mixpanel
 *
 * Debug mode is enabled in development only
 */
export function getAnalyticsConfig(): AnalyticsConfig {
  const isClient = typeof window !== 'undefined'

  // Only initialize on client-side
  if (!isClient) {
    return {
      enabled: false,
      debugMode: false,
      ga4: { measurementId: undefined, enabled: false },
      mixpanel: { token: undefined, enabled: false },
    }
  }

  const ga4MeasurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
  const mixpanelToken = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN

  // Analytics is enabled if at least one platform has credentials
  const ga4Enabled = !!ga4MeasurementId
  const mixpanelEnabled = !!mixpanelToken
  const enabled = ga4Enabled || mixpanelEnabled

  // Debug mode only in development
  const debugMode = process.env.NODE_ENV === 'development'

  return {
    enabled,
    debugMode,
    ga4: {
      measurementId: ga4MeasurementId,
      enabled: ga4Enabled,
    },
    mixpanel: {
      token: mixpanelToken,
      enabled: mixpanelEnabled,
    },
  }
}

/**
 * Singleton config instance (lazy-loaded to avoid SSR issues)
 * Using Proxy to defer config creation until first access, ensuring it runs client-side
 */
let _analyticsConfig: AnalyticsConfig | null = null

export const analyticsConfig: AnalyticsConfig = new Proxy({} as AnalyticsConfig, {
  get(_target, prop) {
    if (!_analyticsConfig) {
      _analyticsConfig = getAnalyticsConfig()
    }
    return _analyticsConfig[prop as keyof AnalyticsConfig]
  },
})

/**
 * Validate configuration (call before first use)
 */
export function validateConfig(): void {
  if (!analyticsConfig.enabled) {
    if (analyticsConfig.debugMode) {
      console.log('[Analytics] Disabled - no platform credentials configured')
    }
    return
  }

  if (analyticsConfig.debugMode) {
    console.log('[Analytics] Configuration:', {
      enabled: analyticsConfig.enabled,
      ga4Enabled: analyticsConfig.ga4.enabled,
      mixpanelEnabled: analyticsConfig.mixpanel.enabled,
    })
  }
}

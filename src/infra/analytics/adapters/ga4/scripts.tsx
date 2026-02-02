/**
 * GA4 Script Loader
 *
 * Loads Google Analytics 4 scripts
 * Only loads when analytics is enabled
 */

'use client'

import Script from 'next/script'
import { analyticsConfig } from '../../config'

/**
 * GA4 Script Component
 *
 * Loads gtag.js and initializes GA4
 * Must be rendered in app layout
 */
export function GA4Scripts() {
  // Debug log to verify component is rendering and config state
  console.log('[GA4Scripts] Rendering:', {
    enabled: analyticsConfig.enabled,
    ga4Enabled: analyticsConfig.ga4.enabled,
    measurementId: analyticsConfig.ga4.measurementId,
  })

  // Only load if enabled
  if (!analyticsConfig.enabled || !analyticsConfig.ga4.enabled) {
    console.warn('[GA4Scripts] Not loading - analytics disabled')
    return null
  }

  const measurementId = analyticsConfig.ga4.measurementId

  if (!measurementId) {
    console.warn('[Analytics/GA4] No measurement ID - scripts not loaded')
    return null
  }

  return (
    <>
      {/* Initialize gtag function FIRST (must run before gtag.js loads) */}
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>

      {/* Load gtag.js AFTER gtag is defined */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
    </>
  )
}

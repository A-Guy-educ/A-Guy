/**
 * GA4 Script Loader
 *
 * Loads Google Analytics 4 scripts
 * Only loads when analytics is enabled
 */

'use client'

import Script from 'next/script'
import { analyticsConfig } from '../../config'
import { initializeGA4 } from './adapter'

/**
 * GA4 Script Component
 *
 * Loads gtag.js and initializes GA4
 * Must be rendered in app layout
 */
export function GA4Scripts() {
  // Only load if enabled
  if (!analyticsConfig.enabled || !analyticsConfig.ga4.enabled) {
    return null
  }

  const measurementId = analyticsConfig.ga4.measurementId

  if (!measurementId) {
    if (analyticsConfig.debugMode) {
      console.warn('[Analytics/GA4] No measurement ID - scripts not loaded')
    }
    return null
  }

  return (
    <>
      {/* Load gtag.js */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        onLoad={() => {
          // Initialize GA4 after script loads
          initializeGA4()
        }}
      />

      {/* Initialize gtag function */}
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
        `}
      </Script>
    </>
  )
}

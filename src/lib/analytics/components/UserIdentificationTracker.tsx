'use client'

import { detectBrowserLocale } from '@/i18n/config'
import { useEffect } from 'react'
import { PRODUCT_EVENTS } from '../contracts/events'
import { useAnalytics } from '../providers/AnalyticsProvider'
import {
  getCachedUserProperties,
  shouldRefreshUserProperties,
  updateCachedUserProperties,
} from '../utils/user-properties-cache'

/**
 * Tracks user_identified event when user is logged in
 * Should be placed in the root layout after AnalyticsProvider
 *
 * Enhanced to send full user profile properties to Mixpanel People
 * Uses localStorage cache to persist user properties across sessions
 */
export function UserIdentificationTracker() {
  const analytics = useAnalytics()

  useEffect(() => {
    // Check if user is authenticated by checking for payload-token cookie
    const checkAuth = async () => {
      try {
        // Check cache first - avoid unnecessary API calls
        const cached = getCachedUserProperties()
        const needsRefresh = shouldRefreshUserProperties()

        // If we have fresh cached data, use it without API call
        if (cached && !needsRefresh) {
          const trackedUserId = sessionStorage.getItem('analytics_tracked_user_id')

          if (trackedUserId !== cached.user_id) {
            // Identify user with cached properties
            analytics.identify(cached.user_id, { ...cached })
            sessionStorage.setItem('analytics_tracked_user_id', cached.user_id)
          }
          return
        }

        // Otherwise, fetch fresh user data from API
        const response = await fetch('/api/users/me', {
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          const user = data.user

          if (user && user.id) {
            // Check if we've already tracked this user in this session
            const trackedUserId = sessionStorage.getItem('analytics_tracked_user_id')

            if (trackedUserId !== user.id || needsRefresh) {
              // Extract non-PII user properties
              const userProperties: Record<string, unknown> = {
                user_id: user.id,
                is_new_user: false, // Existing user logging in
              }

              // Add enriched user profile properties (non-PII)
              if (user.role) {
                userProperties.role = user.role
              }

              if (user.createdAt) {
                userProperties.signup_date = new Date(user.createdAt).toISOString()
              }

              // Add current login timestamp
              userProperties.last_login = new Date().toISOString()

              // Add locale if available from browser or user settings
              if (typeof window !== 'undefined') {
                userProperties.locale = detectBrowserLocale()
              }

              // Cache user properties for future sessions
              updateCachedUserProperties(userProperties)

              // Track user_identified event with enriched properties
              // This will trigger both event tracking AND people.set() in Mixpanel
              analytics.track(PRODUCT_EVENTS.USER_IDENTIFIED, userProperties)

              // Additionally call identify() to ensure user properties are set
              analytics.identify(user.id, userProperties)

              sessionStorage.setItem('analytics_tracked_user_id', user.id)
            }
          }
        }
      } catch (_error) {
        // Silently fail - user is not authenticated or API error
      }
    }

    checkAuth()
  }, [analytics])

  return null
}

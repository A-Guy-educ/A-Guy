'use client'

import { detectBrowserLocale } from '@/i18n/config'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { useEffect } from 'react'
import { identify } from '../core/tracker'
import {
  getCachedUserProperties,
  shouldRefreshUserProperties,
  updateCachedUserProperties,
} from '../utils/user-properties-cache'

/**
 * Tracks user_resolved event when user is logged in
 * Should be placed in the root layout after AnalyticsProvider
 *
 * Enhanced to send full user profile properties to Mixpanel People
 * Uses localStorage cache to persist user properties across sessions
 */
export function UserIdentificationTracker() {
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
            // Login only needs identify() — alias() is only for signup
            identify(cached.user_id, { ...cached })
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
              // Extract user properties
              const userProperties: Record<string, unknown> = {
                user_id: user.id,
                is_new_user: false, // Existing user logging in
              }

              // Add user email (using Mixpanel reserved property)
              if (user.email) {
                userProperties.$email = user.email
              }

              // Add user name (using Mixpanel reserved property)
              if (user.name) {
                userProperties.$name = user.name
              }

              // Add enriched user profile properties
              if (user.role) {
                userProperties.role = user.role
              }

              if (user.createdAt) {
                userProperties.signup_date = new Date(user.createdAt).toISOString()
              }

              // Add current login timestamp
              userProperties.last_login = new Date().toISOString()

              // Add enrolled course ID to Mixpanel People profile
              if (Array.isArray(user.courseEntitlements) && user.courseEntitlements.length > 0) {
                const entry = user.courseEntitlements[0] as {
                  course: string | { id: string }
                }
                userProperties.enrolled_course =
                  typeof entry.course === 'string' ? entry.course : entry.course.id
              }

              // Add locale if available from browser or user settings
              if (typeof window !== 'undefined') {
                userProperties.locale = detectBrowserLocale()
              }

              // Cache user properties for future sessions
              updateCachedUserProperties(userProperties)

              // Identify user with full properties (login only needs identify, not alias)
              identify(user.id, userProperties)

              // Emit user_resolved after identify so events fire under the real user
              systemEventBus.emit(SYSTEM_EVENTS.USER_RESOLVED, {
                user_id: user.id,
                is_anonymous: false,
              })

              sessionStorage.setItem('analytics_tracked_user_id', user.id)
            }
          }
        }
      } catch (_error) {
        // Silently fail - user is not authenticated or API error
      }
    }

    checkAuth()
  }, [])

  return null
}

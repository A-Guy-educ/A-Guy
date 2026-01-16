'use client'

import { useEffect } from 'react'
import { useAnalytics } from '../providers/AnalyticsProvider'
import { PRODUCT_EVENTS } from '../contracts/events'

/**
 * Tracks user_identified event when user is logged in
 * Should be placed in the root layout after AnalyticsProvider
 */
export function UserIdentificationTracker() {
  const analytics = useAnalytics()

  useEffect(() => {
    // Check if user is authenticated by checking for payload-token cookie
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/users/me', {
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          const user = data.user

          if (user && user.id) {
            // Check if we've already tracked this user in this session
            const trackedUserId = sessionStorage.getItem('analytics_tracked_user_id')

            if (trackedUserId !== user.id) {
              // Track user_identified for this session
              analytics.track(PRODUCT_EVENTS.USER_IDENTIFIED, {
                user_id: user.id,
                is_new_user: false, // Existing user logging in
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
  }, [analytics])

  return null
}

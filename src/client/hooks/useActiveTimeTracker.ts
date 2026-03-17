/**
 * Active Time Tracker Hook
 *
 * Tracks user active time with heartbeat mechanism.
 * Pauses when user switches to a different browser tab.
 */

'use client'

import { useCallback, useEffect, useRef } from 'react'

const HEARTBEAT_INTERVAL_MS = 30000 // 30 seconds
const STREAK_THRESHOLD_MS = 60000 // 1 minute

interface UseActiveTimeTrackerOptions {
  isAuthenticated: boolean
  enabled?: boolean
}

export function useActiveTimeTracker({
  isAuthenticated,
  enabled = true,
}: UseActiveTimeTrackerOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const cumulativeTimeRef = useRef<number>(0)
  const streakSentRef = useRef<boolean>(false)
  const isVisibleRef = useRef<boolean>(true)

  const sendHeartbeat = useCallback(async (seconds: number) => {
    try {
      await fetch('/api/stats/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ seconds }),
      })
    } catch (error) {
      console.error('Failed to send heartbeat:', error)
    }
  }, [])

  const sendStreakUpdate = useCallback(async () => {
    if (streakSentRef.current) return // Already sent today

    try {
      await fetch('/api/stats/streak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      streakSentRef.current = true
    } catch (error) {
      console.error('Failed to send streak update:', error)
    }
  }, [])

  const handleVisibilityChange = useCallback(() => {
    isVisibleRef.current = document.visibilityState === 'visible'
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !enabled) {
      return
    }

    // Set up visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange)
    isVisibleRef.current = document.visibilityState === 'visible'

    // Start the heartbeat interval
    intervalRef.current = setInterval(() => {
      if (!isVisibleRef.current) {
        // Tab is hidden, don't send heartbeat
        return
      }

      // Send heartbeat every 30 seconds
      sendHeartbeat(30)

      // Track cumulative time for streak
      cumulativeTimeRef.current += HEARTBEAT_INTERVAL_MS

      // Check if we've reached the 5-minute threshold for streak
      if (cumulativeTimeRef.current >= STREAK_THRESHOLD_MS) {
        sendStreakUpdate()
        cumulativeTimeRef.current = 0 // Reset after sending streak
      }
    }, HEARTBEAT_INTERVAL_MS)

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, enabled, sendHeartbeat, sendStreakUpdate, handleVisibilityChange])

  // Reset streak sent flag at midnight (local time)
  useEffect(() => {
    const now = new Date()
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).getTime() -
      now.getTime()

    const timeout = setTimeout(() => {
      streakSentRef.current = false
      cumulativeTimeRef.current = 0
    }, msUntilMidnight)

    return () => clearTimeout(timeout)
  }, [])
}

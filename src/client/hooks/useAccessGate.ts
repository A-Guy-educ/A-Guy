'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import {
  clearGateTimer,
  getGateTimerStart,
  setGateTimerStart,
} from '@/client/state/localStorage/accessGateTimer'
import type { AccessType } from '@/server/constants/access-types'
import { GATED_DELAY_MS, GATED_WARNING_MS } from '@/server/constants/access-types'

interface UseAccessGateParams {
  accessType: AccessType | string
  courseSlug: string
}

interface UseAccessGateReturn {
  showMandatoryModal: boolean
  showGatedModal: boolean
  showWarningModal: boolean
  warningSecondsLeft: number
  dismissWarning: () => void
  user: ReturnType<typeof useCurrentUser>['user']
  isAuthLoading: boolean
}

export function useAccessGate({
  accessType,
  courseSlug,
}: UseAccessGateParams): UseAccessGateReturn {
  const { user, isLoading: isAuthLoading } = useCurrentUser()
  const [elapsedMs, setElapsedMs] = useState(0)
  const [warningDismissed, setWarningDismissed] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isGated = accessType === 'gated'
  const isMandatory = accessType === 'mandatory'
  const isAnonymous = !user && !isAuthLoading

  // Clear stale timer when user is detected on mount (full-page reload after OAuth)
  useEffect(() => {
    if (user && isGated) {
      clearGateTimer(courseSlug)
    }
  }, [user, isGated, courseSlug])

  // Start/manage gated timer
  useEffect(() => {
    if (!isGated || user || isAuthLoading) {
      // Clear interval if user logs in or mode is not gated
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setElapsedMs(0)
      return
    }

    // Initialize timer start if not already set
    let startTime = getGateTimerStart(courseSlug)
    if (!startTime) {
      startTime = Date.now()
      setGateTimerStart(courseSlug, startTime)
    }

    // Update elapsed time every second
    const updateElapsed = () => {
      const stored = getGateTimerStart(courseSlug)
      if (stored) {
        setElapsedMs(Date.now() - stored)
      }
    }

    updateElapsed()
    intervalRef.current = setInterval(updateElapsed, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isGated, user, isAuthLoading, courseSlug])

  // Clear timer when user logs in (SPA navigation, no full reload)
  const handleAuthChange = useCallback(() => {
    clearGateTimer(courseSlug)
    setElapsedMs(0)
  }, [courseSlug])

  useEffect(() => {
    window.addEventListener('auth:changed', handleAuthChange)
    return () => window.removeEventListener('auth:changed', handleAuthChange)
  }, [handleAuthChange])

  const dismissWarning = useCallback(() => {
    setWarningDismissed(true)
  }, [])

  // Compute state
  const warningThreshold = GATED_DELAY_MS - GATED_WARNING_MS
  const inWarningPeriod =
    isGated && isAnonymous && elapsedMs >= warningThreshold && elapsedMs < GATED_DELAY_MS
  const showWarningModal = inWarningPeriod && !warningDismissed
  const showGatedModal = isGated && isAnonymous && elapsedMs >= GATED_DELAY_MS
  const showMandatoryModal = isMandatory && isAnonymous

  const warningSecondsLeft = inWarningPeriod
    ? Math.max(0, Math.ceil((GATED_DELAY_MS - elapsedMs) / 1000))
    : 0

  return {
    showMandatoryModal,
    showGatedModal,
    showWarningModal,
    warningSecondsLeft,
    dismissWarning,
    user,
    isAuthLoading,
  }
}

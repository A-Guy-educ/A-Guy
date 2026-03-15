'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import {
  clearGateTimer,
  getGateTimerStart,
  setGateTimerStart,
} from '@/client/state/localStorage/accessGateTimer'

import type { AccessType } from '@/infra/auth/access-types'
import { GATED_DELAY_MS, GATED_WARNING_MS } from '@/infra/auth/access-types'

interface UseAccessGateParams {
  accessType: AccessType | string
  courseSlug: string
  /** Total gated delay before lock-out (ms). Falls back to GATED_DELAY_MS constant. */
  gatedDelayMs?: number
  /** Warning duration before lock-out (ms). Falls back to GATED_WARNING_MS constant. */
  gatedWarningMs?: number
  /** Lesson ID for access code gate */
  lessonId?: string
}

interface UseAccessGateReturn {
  showMandatoryModal: boolean
  showGatedModal: boolean
  showWarningModal: boolean
  showAccessCodeModal: boolean
  warningSecondsLeft: number
  dismissWarning: () => void
  user: ReturnType<typeof useCurrentUser>['user']
  isAuthLoading: boolean
}

export function useAccessGate({
  accessType,
  courseSlug,
  gatedDelayMs: gatedDelayMsProp,
  gatedWarningMs: gatedWarningMsProp,
  lessonId,
}: UseAccessGateParams): UseAccessGateReturn {
  const gatedDelayMs = gatedDelayMsProp ?? GATED_DELAY_MS
  const gatedWarningMs = gatedWarningMsProp ?? GATED_WARNING_MS
  const { user, isLoading: isAuthLoading } = useCurrentUser()
  const [elapsedMs, setElapsedMs] = useState(0)
  const [warningDismissed, setWarningDismissed] = useState(false)
  const [hasRedeemedCode, setHasRedeemedCode] = useState(false)
  const [isCheckingRedemption, setIsCheckingRedemption] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pausedAtRef = useRef<number | null>(null)

  const isGated = accessType === 'gated'
  const isMandatory = accessType === 'mandatory'
  const isAccessCode = accessType === 'accessCode'
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

  // Check if user has already redeemed a code for this lesson
  useEffect(() => {
    // Only check when accessCode type and user is authenticated
    if (!isAccessCode || !user || !lessonId || isAuthLoading) {
      return
    }

    const checkRedemption = async () => {
      setIsCheckingRedemption(true)
      try {
        const response = await fetch(`/api/access-codes/check?lessonId=${lessonId}`)
        const data = await response.json()
        if (data.redeemed) {
          setHasRedeemedCode(true)
        }
      } catch {
        // If check fails, show modal to be safe
        setHasRedeemedCode(false)
      } finally {
        setIsCheckingRedemption(false)
      }
    }

    checkRedemption()
  }, [isAccessCode, user, lessonId, isAuthLoading])

  // Compute state
  const warningThreshold = gatedDelayMs - gatedWarningMs
  const inWarningPeriod =
    isGated && isAnonymous && elapsedMs >= warningThreshold && elapsedMs < gatedDelayMs
  const showWarningModal = inWarningPeriod && !warningDismissed
  const showGatedModal = isGated && isAnonymous && elapsedMs >= gatedDelayMs
  const showMandatoryModal = isMandatory && isAnonymous
  // Show access code modal for authenticated users who haven't redeemed yet
  const showAccessCodeModal: boolean =
    isAccessCode && !!user && !isAuthLoading && !hasRedeemedCode && !isCheckingRedemption

  const warningSecondsLeft = inWarningPeriod
    ? Math.max(0, Math.ceil((gatedDelayMs - elapsedMs) / 1000))
    : 0

  // Pause/resume timer when warning modal opens/closes
  useEffect(() => {
    if (showWarningModal) {
      // Pause: stop advancing the timer while the modal is visible
      pausedAtRef.current = Date.now()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    } else if (pausedAtRef.current !== null) {
      // Resume: shift the stored start time forward by the paused duration
      // so elapsed time continues from where it was paused
      const pausedDuration = Date.now() - pausedAtRef.current
      pausedAtRef.current = null

      const currentStart = getGateTimerStart(courseSlug)
      if (currentStart) {
        setGateTimerStart(courseSlug, currentStart + pausedDuration)
      }

      // Restart the interval
      const updateElapsed = () => {
        const stored = getGateTimerStart(courseSlug)
        if (stored) {
          setElapsedMs(Date.now() - stored)
        }
      }
      updateElapsed()
      intervalRef.current = setInterval(updateElapsed, 1000)
    }
  }, [showWarningModal, courseSlug])

  return {
    showMandatoryModal,
    showGatedModal,
    showWarningModal,
    showAccessCodeModal,
    warningSecondsLeft,
    dismissWarning,
    user,
    isAuthLoading,
  }
}

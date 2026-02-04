'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { loadingManager } from '../LoadingManager'
import { cn } from '@/infra/utils/ui'
import { LOADING_KEYS } from '../keys'

const VISIBILITY_THRESHOLD_MS = 300 // Don't show for fast navigations
const HIDE_DELAY_MS = 150 // Smooth hide transition
const MIN_VISIBLE_TIME_MS = 500 // Prevent flicker on rapid nav

/**
 * Global route loading indicator
 * - Indeterminate progress bar (no fake percentages)
 * - Only shows if navigation exceeds threshold
 * - Non-blocking (not a modal)
 * - Stuck-protection via LoadingManager safety timeout
 * - Flicker prevention via minimum visible time
 *
 * Loading is started by SystemLink/useRouterWithLoading at trigger time,
 * and ends when pathname/searchParams change (navigation completed).
 */
export function RouteLoadingIndicator() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isVisible, setIsVisible] = useState(false)
  const visibilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visibleSinceRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)

  // Cleanup all timers
  const clearTimers = useCallback(() => {
    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current)
      visibilityTimeoutRef.current = null
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }, [])

  // Safe hide with minimum visible time enforcement
  const scheduleHide = useCallback(() => {
    if (!isMountedRef.current) return

    // Clear any pending show timeout
    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current)
      visibilityTimeoutRef.current = null
    }

    // Calculate how long we've been visible
    const visibleFor = visibleSinceRef.current ? Date.now() - visibleSinceRef.current : 0

    // Ensure minimum visible time to prevent flicker
    const remainingMinTime = Math.max(0, MIN_VISIBLE_TIME_MS - visibleFor)
    const totalDelay = remainingMinTime + HIDE_DELAY_MS

    hideTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setIsVisible(false)
        visibleSinceRef.current = null
      }
    }, totalDelay)
  }, [])

  // Watch for route loading state changes
  useEffect(() => {
    isMountedRef.current = true

    const checkVisibility = () => {
      if (!isMountedRef.current) return

      const isRouteBusy = loadingManager.isKeyBusy(LOADING_KEYS.ROUTE_TRANSITION)

      if (isRouteBusy && !isVisible) {
        // Clear any pending hide
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current)
          hideTimeoutRef.current = null
        }

        // Delay showing to avoid flash for fast navigations
        visibilityTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return
          // Re-check in case navigation completed during delay
          if (loadingManager.isKeyBusy(LOADING_KEYS.ROUTE_TRANSITION)) {
            visibleSinceRef.current = Date.now()
            setIsVisible(true)
          }
        }, VISIBILITY_THRESHOLD_MS)
      } else if (!isRouteBusy && isVisible) {
        scheduleHide()
      } else if (!isRouteBusy && !isVisible) {
        // Clear pending show timeout if navigation completed quickly
        clearTimers()
      }
    }

    const unsubscribe = loadingManager.subscribe(checkVisibility)
    checkVisibility() // Initial check

    return () => {
      isMountedRef.current = false
      unsubscribe()
      clearTimers()
    }
  }, [isVisible, scheduleHide, clearTimers])

  // End route loading when navigation completes (pathname/searchParams change)
  useEffect(() => {
    loadingManager.unregister(LOADING_KEYS.ROUTE_TRANSITION)
  }, [pathname, searchParams])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      loadingManager.unregister(LOADING_KEYS.ROUTE_TRANSITION)
      clearTimers()
    }
  }, [clearTimers])

  if (!isVisible) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-primary/20 overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Page loading"
    >
      {/* Indeterminate animation - sliding bar */}
      <div
        className={cn(
          'h-full bg-primary w-1/3',
          'animate-[loading-slide_1.5s_ease-in-out_infinite]',
        )}
      />
      <style jsx>{`
        @keyframes loading-slide {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(200%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  )
}

'use client'

import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import Link, { type LinkProps } from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/infra/utils/ui'
import { loadingManager } from '../LoadingManager'
import { LOADING_KEYS } from '../keys'
import { resolveHrefToString, buildCurrentPath } from '../utils/resolveHref'
import { useLoadingState } from '../hooks/useLoadingState'

interface SystemLinkProps extends LinkProps {
  children: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

/**
 * Link component that registers route loading at trigger time
 * Shows local loading indication (reduced opacity) when clicked
 *
 * Use this for all navigation links to provide consistent loading feedback.
 *
 * NOTE: Route loading registration is deferred to useEffect to avoid
 * hydration mismatches. The loadingManager.register() call happens after
 * mount, so the isRouteBusy snapshot stays consistent between server
 * (getServerSnapshot returns false) and initial client render (false).
 * The loading state will show on the subsequent render (before navigation
 * typically completes).
 */
export const SystemLink = forwardRef<HTMLAnchorElement, SystemLinkProps>(function SystemLink(
  { href, onClick, children, className, ...props },
  ref,
) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [wasClicked, setWasClicked] = useState(false)
  const pendingNavigationRef = useRef(false)
  const isRouteLoading = useLoadingState({ key: LOADING_KEYS.ROUTE_TRANSITION })

  // Show loading state if this link was clicked and route is loading
  const isLoading = wasClicked && isRouteLoading

  // Register route loading after mount to prevent hydration mismatches.
  // This runs after the first render completes, so the initial client
  // render has isRouteBusy = false (matching server), and the loading
  // state shows on the second render (before navigation completes).
  useEffect(() => {
    if (pendingNavigationRef.current) {
      loadingManager.register(LOADING_KEYS.ROUTE_TRANSITION, 'route')
    }
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Call original onClick if provided
      onClick?.(e)

      // Don't handle if default was prevented or modifier keys
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) {
        return
      }

      // Don't handle external links
      const hrefStr = typeof href === 'string' ? href : href.pathname || ''
      if (
        hrefStr.startsWith('http://') ||
        hrefStr.startsWith('https://') ||
        hrefStr.startsWith('//')
      ) {
        return
      }

      // Don't handle hash-only links (same page anchor)
      if (hrefStr.startsWith('#') || (typeof href === 'object' && !href.pathname && href.hash)) {
        return
      }

      // Normalize both paths for reliable comparison (ignore hash - same-page anchor)
      const targetPath = resolveHrefToString(href, true)
      const currentPath = buildCurrentPath(pathname, searchParams)

      // Only register loading if actually navigating to different page
      if (currentPath !== targetPath) {
        setWasClicked(true)
        pendingNavigationRef.current = true
        // NOTE: loadingManager.register() is NOT called here.
        // It's deferred to useEffect above to prevent hydration mismatches.
        // The loading state will show on the next render after useEffect fires.
      }
    },
    [href, onClick, pathname, searchParams],
  )

  return (
    <Link
      ref={ref}
      href={href}
      onClick={handleClick}
      className={cn(
        className,
        isLoading && 'opacity-60 pointer-events-none',
        'transition-opacity duration-150',
      )}
      aria-disabled={isLoading}
      {...props}
    >
      {children}
    </Link>
  )
})

'use client'

import React, { forwardRef, useCallback } from 'react'
import Link, { type LinkProps } from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { loadingManager } from '../LoadingManager'
import { LOADING_KEYS } from '../keys'
import { resolveHrefToString, buildCurrentPath } from '../utils/resolveHref'

interface SystemLinkProps extends LinkProps {
  children: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

/**
 * Link component that registers route loading at trigger time
 *
 * Use this for the migrated hotspots in this PR (Header nav, auth form links).
 * Expand to other navigation in a separate task after this stabilizes.
 */
export const SystemLink = forwardRef<HTMLAnchorElement, SystemLinkProps>(function SystemLink(
  { href, onClick, children, ...props },
  ref,
) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

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
        loadingManager.register(LOADING_KEYS.ROUTE_TRANSITION, 'route')
      }
    },
    [href, onClick, pathname, searchParams],
  )

  return (
    <Link ref={ref} href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  )
})

/**
 * Utility functions for UI components automatically added by ShadCN and used in a few of our frontend components and blocks.
 *
 * Other functions may be exported from here in the future or by installing other shadcn components.
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Detects if the current device is a mobile/touch device
 * Uses multiple checks for reliability across different browsers
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false

  // Check for touch support
  const hasTouchScreen =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0

  // Check user agent for mobile devices
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
  const isMobileUserAgent = mobileRegex.test(navigator.userAgent)

  // Check screen width (common mobile breakpoint)
  const isSmallScreen = window.innerWidth < 768

  // Consider it mobile if it has touch AND (is mobile UA OR small screen)
  return hasTouchScreen && (isMobileUserAgent || isSmallScreen)
}

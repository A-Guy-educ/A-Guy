/**
 * Anonymous ID Management
 *
 * Generates and manages persistent anonymous IDs for tracking users before authentication
 */

import { getCookie, setCookie, deleteCookie } from './cookies'

export const ANONYMOUS_ID_COOKIE_NAME = 'mp_anon_id'

/**
 * Generate a new anonymous ID
 *
 * Format: anon_<uuid-v4>
 *
 * @returns New anonymous ID
 */
export function generateAnonymousId(): string {
  // Generate UUID v4
  const uuid = crypto.randomUUID()
  return `anon_${uuid}`
}

/**
 * Validate that an ID matches the anonymous ID format
 *
 * @param id - ID to validate
 * @returns True if valid anonymous ID format
 */
function isValidAnonymousId(id: string): boolean {
  const uuidRegex = /^anon_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

/**
 * Get existing anonymous ID from cookie, or generate new one
 *
 * @returns Anonymous ID
 */
export function getOrCreateAnonymousId(): string {
  try {
    // Try to get existing ID from cookie
    const existingId = getCookie(ANONYMOUS_ID_COOKIE_NAME)

    if (existingId && isValidAnonymousId(existingId)) {
      return existingId
    }
  } catch (error) {
    // Gracefully handle cookie read errors
    console.warn('[Analytics] Failed to read anonymous ID cookie:', error)
  }

  // Generate new ID and store in cookie
  const newId = generateAnonymousId()
  setAnonymousIdCookie(newId)

  return newId
}

/**
 * Set the anonymous ID cookie
 *
 * @param id - Anonymous ID to store
 * @param isSecure - Whether to set Secure flag (default: false, should be true in production)
 */
export function setAnonymousIdCookie(id: string, isSecure = false): void {
  setCookie(ANONYMOUS_ID_COOKIE_NAME, id, {
    expiryDays: 365, // 1 year
    isSecure,
  })
}

/**
 * Clear the anonymous ID cookie
 */
export function clearAnonymousIdCookie(): void {
  deleteCookie(ANONYMOUS_ID_COOKIE_NAME)
}

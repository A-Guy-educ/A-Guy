/**
 * localStorage utilities for access gate timers (gated access mode).
 * SSR-safe implementations that check for window availability.
 *
 * NOTE: This timer is a UX nudge only, not a security enforcement mechanism.
 * Users can reset the timer by clearing localStorage or using incognito mode.
 * For true server-side enforcement, a signed-cookie or DB-backed timer would
 * be required. The current design intentionally favours a lightweight,
 * low-friction approach to encourage registration without hard-blocking content.
 */

const STORAGE_KEY_PREFIX = 'a-guy:access-gate-timer:'

/**
 * Get the start timestamp for a course's gated timer (SSR-safe)
 */
export const getGateTimerStart = (courseSlug: string): number | null => {
  if (typeof window === 'undefined') return null
  try {
    const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${courseSlug}`)
    return data ? Number(data) : null
  } catch {
    return null
  }
}

/**
 * Set the start timestamp for a course's gated timer (SSR-safe)
 */
export const setGateTimerStart = (courseSlug: string, timestamp: number): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${courseSlug}`, String(timestamp))
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Clear the gated timer for a specific course (SSR-safe)
 */
export const clearGateTimer = (courseSlug: string): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${courseSlug}`)
  } catch {
    // Storage unavailable
  }
}

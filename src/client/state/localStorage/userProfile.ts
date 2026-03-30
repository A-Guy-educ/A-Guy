/**
 * localStorage utilities for anonymous user profile
 * SSR-safe implementations that check for window availability
 */

export interface LocalUserProfile {
  gradeLevel: string // "8", "ח", etc.
  mood?: string
  lastVisit: string // ISO date
}

const STORAGE_KEYS = {
  USER_PROFILE: 'a-guy:user-profile',
} as const

/**
 * Get user profile from localStorage (SSR-safe)
 */
export const getUserProfile = (): LocalUserProfile | null => {
  if (typeof window === 'undefined') return null
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

/**
 * Cookie name for server-side grade access.
 * Mirrors gradeLevel from localStorage so server components can prefetch data.
 */
export const GRADE_COOKIE_NAME = 'a-guy:grade'

/**
 * Set user profile in localStorage (SSR-safe)
 * Also sets a grade cookie so server components can prefetch data.
 */
export const setUserProfile = (profile: LocalUserProfile): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile))

    // Mirror grade to cookie for server-side access
    if (profile.gradeLevel) {
      document.cookie = `${GRADE_COOKIE_NAME}=${encodeURIComponent(profile.gradeLevel)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    }
  } catch (error) {
    console.error('Failed to save user profile to localStorage:', error)
  }
}

/**
 * Clear user profile from localStorage (SSR-safe)
 */
export const clearUserProfile = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE)
  } catch (error) {
    console.error('Failed to clear user profile from localStorage:', error)
  }
}

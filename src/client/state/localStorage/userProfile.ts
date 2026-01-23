/**
 * localStorage utilities for anonymous user profile and progress
 * SSR-safe implementations that check for window availability
 */

export interface LocalUserProfile {
  gradeLevel: string // "8", "ח", etc.
  mood?: string
  lastVisit: string // ISO date
}

export interface LocalProgressRecord {
  recordId: string
  recordType: 'chapter' | 'lesson' | 'exercise'
  completionPercentage: number
  status: 'not_started' | 'in_progress' | 'completed'
  lastAccessedAt: string // ISO date
}

const STORAGE_KEYS = {
  USER_PROFILE: 'a-guy:user-profile',
  PROGRESS: 'a-guy:progress',
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
 * Set user profile in localStorage (SSR-safe)
 */
export const setUserProfile = (profile: LocalUserProfile): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile))
  } catch (error) {
    console.error('Failed to save user profile to localStorage:', error)
  }
}

/**
 * Get local progress records from localStorage (SSR-safe)
 */
export const getLocalProgress = (): LocalProgressRecord[] => {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRESS)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * Update a single progress record in localStorage (SSR-safe)
 */
export const updateLocalProgress = (record: LocalProgressRecord): void => {
  if (typeof window === 'undefined') return
  try {
    const current = getLocalProgress()
    const index = current.findIndex(
      (r) => r.recordId === record.recordId && r.recordType === record.recordType,
    )

    if (index >= 0) {
      current[index] = record
    } else {
      current.push(record)
    }

    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(current))
  } catch (error) {
    console.error('Failed to update progress in localStorage:', error)
  }
}

/**
 * Clear all local progress (SSR-safe)
 */
export const clearLocalProgress = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEYS.PROGRESS)
  } catch (error) {
    console.error('Failed to clear progress from localStorage:', error)
  }
}

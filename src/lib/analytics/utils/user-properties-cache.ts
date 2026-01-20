/**
 * User Properties Cache
 *
 * Manages persistent storage of user properties for analytics
 * Stores non-PII user properties in localStorage for cross-session persistence
 *
 * CRITICAL: Only store non-PII properties (no emails, names, etc.)
 */

const CACHE_KEY = 'analytics_user_properties'

export interface CachedUserProperties {
  user_id: string
  role?: string
  signup_date?: string
  locale?: string
  last_login?: string
  auth_method?: 'google' | 'email'
  is_new_user?: boolean
}

/**
 * Get cached user properties from localStorage
 */
export function getCachedUserProperties(): CachedUserProperties | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    return JSON.parse(cached) as CachedUserProperties
  } catch (_error) {
    // Invalid JSON or storage error
    return null
  }
}

/**
 * Set cached user properties in localStorage
 */
export function setCachedUserProperties(properties: CachedUserProperties): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(properties))
  } catch (_error) {
    // Storage quota exceeded or other error - fail silently
  }
}

/**
 * Update cached user properties (merge with existing)
 */
export function updateCachedUserProperties(properties: Partial<CachedUserProperties>): void {
  if (typeof window === 'undefined') return

  const cached = getCachedUserProperties()
  const updated = {
    ...cached,
    ...properties,
  }

  setCachedUserProperties(updated as CachedUserProperties)
}

/**
 * Clear cached user properties (on logout)
 */
export function clearCachedUserProperties(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(CACHE_KEY)
  } catch (_error) {
    // Fail silently
  }
}

/**
 * Check if user properties need refresh (e.g., stale data)
 * Returns true if last_login is older than 24 hours
 */
export function shouldRefreshUserProperties(): boolean {
  if (typeof window === 'undefined') return false

  const cached = getCachedUserProperties()
  if (!cached || !cached.last_login) return true

  try {
    const lastLogin = new Date(cached.last_login)
    const now = new Date()
    const hoursSinceLastLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60)

    // Refresh if more than 24 hours since last login
    return hoursSinceLastLogin > 24
  } catch (_error) {
    return true
  }
}

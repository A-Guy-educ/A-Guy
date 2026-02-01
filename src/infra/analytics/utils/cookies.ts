/**
 * Cookie Utilities
 *
 * Client-side cookie management for analytics tracking
 */

export interface SetCookieOptions {
  expiryDays?: number
  isSecure?: boolean
}

/**
 * Get a cookie value by name
 *
 * @param name - Cookie name
 * @returns Cookie value or null if not found
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null

  const cookies = document.cookie.split(';')

  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=').map((c) => c.trim())

    if (cookieName === name) {
      return cookieValue || null
    }
  }

  return null
}

/**
 * Set a cookie with the given name and value
 *
 * @param name - Cookie name
 * @param value - Cookie value
 * @param options - Cookie options (expiry, secure flag)
 */
export function setCookie(name: string, value: string, options: SetCookieOptions = {}): void {
  if (typeof document === 'undefined') return

  const { expiryDays = 365, isSecure = false } = options

  const maxAge = expiryDays * 24 * 60 * 60 // Convert days to seconds

  const cookieParts = [`${name}=${value}`, `path=/`, `max-age=${maxAge}`, `SameSite=Lax`]

  if (isSecure) {
    cookieParts.push('Secure')
  }

  document.cookie = cookieParts.join('; ')
}

/**
 * Delete a cookie by name
 *
 * @param name - Cookie name to delete
 */
export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return

  document.cookie = `${name}=; path=/; max-age=0`
}

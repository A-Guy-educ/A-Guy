/**
 * Persona Cookie Client Utilities
 *
 * Client-side utilities for reading the persona cookie.
 * Used for display purposes in the UI.
 *
 * @fileType utility
 * @domain chat
 * @ai-summary Client-side cookie utilities for persona display
 */

import { getCookie, setCookie, deleteCookie } from '@/infra/analytics/utils/cookies'

export { PERSONA_COOKIE_NAME, DEFAULT_PERSONA_SLUG, VALID_PERSONA_SLUGS } from './persona-cookie'

/**
 * Get persona cookie on client side
 */
export function getPersonaCookieClient(): string | null {
  return getCookie('teacher_persona')
}

/**
 * Set persona cookie on client side (for anonymous users)
 */
export function setPersonaCookieClient(slug: string): void {
  // Short-lived cookie (7 days)
  setCookie('teacher_persona', slug, { expiryDays: 7 })
}

/**
 * Delete persona cookie on client side
 */
export function clearPersonaCookieClient(): void {
  deleteCookie('teacher_persona')
}

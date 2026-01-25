/**
 * OAuth Authentication Constants
 *
 * @fileType constants
 * @domain auth
 * @pattern oauth
 * @ai-summary Cookie configuration and constants for OAuth authentication
 */

import type { Payload } from 'payload'

export function getCookieName(payload: Payload): string {
  return `${payload.config.cookiePrefix}-token`
}

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // Secure only in production (HTTPS required)
  sameSite: process.env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const), // 'none' requires secure
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days - match Payload's default token expiration
}

export const STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 10, // 10 minutes - CSRF state expiry
}

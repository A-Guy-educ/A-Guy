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
  // CHIPS — partition the cookie per top-level site when SameSite=None.
  // Without this, modern Chromium browsers (3PC deprecation) block the
  // cookie entirely in cross-origin iframes, which is how the Kody
  // dashboard renders previews. Result: logout / language change in
  // the preview iframe silently no-op'd because we couldn't write
  // back to our own cookie. Partitioned restores the write/read path
  // (the cookie jar is isolated per embedder, which is fine — each
  // embedder logs in once).
  partitioned: process.env.NODE_ENV === 'production',
}

export const STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 10, // 10 minutes - CSRF state expiry
}

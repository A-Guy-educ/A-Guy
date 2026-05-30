/**
 * OAuth Cookie Helpers
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary Cookie read/write/delete utilities for OAuth flow
 */

import type { NextRequest, NextResponse } from 'next/server'
import type { Payload } from 'payload'
import { AUTH_COOKIE_OPTIONS, STATE_COOKIE_OPTIONS, getCookieName } from './oauth_constants'

export function readCookie(req: NextRequest, name: string): string | undefined {
  return req.cookies.get(name)?.value
}

export function deleteCookie(res: NextResponse, name: string): void {
  // Cookie deletion is "set with empty value + Max-Age=0". To remove a
  // Partitioned cookie the deletion MUST also carry Partitioned (and the
  // matching SameSite=None + Secure) — otherwise the browser treats the
  // deletion as a new unpartitioned cookie and the real partitioned one
  // sits in the iframe's cookie jar untouched. That was the logout bug
  // in the Kody dashboard preview iframe.
  const isProd = process.env.NODE_ENV === 'production'
  // Mirror the deletion across both jars: unpartitioned (top-level path)
  // and partitioned (cross-origin embed path) so whichever the original
  // write used gets cleared.
  res.cookies.set(name, '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  })
  if (isProd) {
    res.headers.append(
      'Set-Cookie',
      [
        `${name}=`,
        'Path=/',
        'Max-Age=0',
        'HttpOnly',
        'Secure',
        'SameSite=None',
        'Partitioned',
      ].join('; '),
    )
  }
}

export function setAuthCookie(res: NextResponse, payload: Payload, value: string): void {
  const cookieName = getCookieName(payload)
  const usersCollection = payload.collections?.users
  const authCookies = usersCollection?.config?.auth?.cookies as
    | { domain?: string; secure?: boolean; sameSite?: string }
    | undefined

  const cookieOptions = {
    ...AUTH_COOKIE_OPTIONS,
    ...(authCookies?.domain ? { domain: authCookies.domain } : {}),
  }

  // Set cookie using both methods to ensure it works
  res.cookies.set(cookieName, value, cookieOptions)

  // Also set Set-Cookie header directly (backup method for redirects)
  const sameSiteValue =
    cookieOptions.sameSite === 'lax' ? 'Lax' : cookieOptions.sameSite === 'none' ? 'None' : 'Strict'
  // CHIPS: the manual Set-Cookie path mirrors AUTH_COOKIE_OPTIONS so the
  // backup write also produces a partitioned cookie. Required for the
  // cookie to be honored inside the Kody dashboard's cross-origin
  // preview iframe (3PC deprecation).
  const partitioned =
    'partitioned' in cookieOptions && (cookieOptions as { partitioned?: boolean }).partitioned
  const cookieString = [
    `${cookieName}=${value}`,
    `Path=${cookieOptions.path}`,
    `Max-Age=${cookieOptions.maxAge}`,
    cookieOptions.httpOnly ? 'HttpOnly' : '',
    cookieOptions.secure ? 'Secure' : '',
    `SameSite=${sameSiteValue}`,
    partitioned ? 'Partitioned' : '',
    cookieOptions.domain ? `Domain=${cookieOptions.domain}` : '',
  ]
    .filter(Boolean)
    .join('; ')

  res.headers.append('Set-Cookie', cookieString)
}

export function setShortLivedCookie(res: NextResponse, name: string, value: string): void {
  res.cookies.set(name, value, STATE_COOKIE_OPTIONS)
}

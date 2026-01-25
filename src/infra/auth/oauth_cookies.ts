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
  res.cookies.delete(name)
}

export function setAuthCookie(res: NextResponse, payload: Payload, value: string): void {
  const cookieName = getCookieName(payload)
  const usersCollection = payload.collections?.users
  const authCookies = usersCollection?.config?.auth?.cookies as
    | { domain?: string; secure?: boolean; sameSite?: string }
    | undefined

  res.cookies.set(cookieName, value, {
    ...AUTH_COOKIE_OPTIONS,
    ...(authCookies?.domain ? { domain: authCookies.domain } : {}),
  })
}

export function setShortLivedCookie(res: NextResponse, name: string, value: string): void {
  res.cookies.set(name, value, STATE_COOKIE_OPTIONS)
}

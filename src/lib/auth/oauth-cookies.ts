import type { NextResponse } from 'next/server'

export const STATE_COOKIE = 'oauth_state'
export const RETURN_TO_COOKIE = 'oauth_return_to'
export const MODE_COOKIE = 'oauth_mode'
export const CODE_VERIFIER_COOKIE = 'oauth_code_verifier'

interface OAuthCookieOptions {
  state: string
  returnTo: string
  mode: 'login' | 'link'
  codeVerifier: string
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 10,
  path: '/',
}

export function setOAuthCookies(response: NextResponse, options: OAuthCookieOptions): void {
  response.cookies.set(STATE_COOKIE, options.state, COOKIE_OPTIONS)
  response.cookies.set(RETURN_TO_COOKIE, options.returnTo, COOKIE_OPTIONS)
  response.cookies.set(MODE_COOKIE, options.mode, COOKIE_OPTIONS)
  response.cookies.set(CODE_VERIFIER_COOKIE, options.codeVerifier, COOKIE_OPTIONS)
}

export function cleanupOAuthCookies(response: NextResponse): void {
  response.cookies.delete(STATE_COOKIE)
  response.cookies.delete(RETURN_TO_COOKIE)
  response.cookies.delete(MODE_COOKIE)
  response.cookies.delete(CODE_VERIFIER_COOKIE)
}

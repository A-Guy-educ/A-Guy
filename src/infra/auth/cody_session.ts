/**
 * Cody Dashboard Session Management
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary Standalone GitHub identity session for the Cody Operations Dashboard.
 *   Uses a signed JWT cookie (cody-gh-session) independent of Payload CMS auth.
 *   Session payload: { login, avatar_url, githubId, iat, exp }
 */

import { SignJWT, jwtVerify } from 'jose'
import type { NextRequest, NextResponse } from 'next/server'

export const CODY_SESSION_COOKIE = 'cody-gh-session'

/** 24-hour sessions — re-auth re-checks collaborator status */
const SESSION_TTL_SECONDS = 60 * 60 * 24

export interface CodyGitHubIdentity {
  login: string
  avatar_url: string
  githubId: number
}

interface CodySessionPayload extends CodyGitHubIdentity {
  iat: number
  exp: number
}

function getSecret(): Uint8Array {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET is required for cody session signing')
  // Prefix to namespace the key from Payload's own JWT usage
  return new TextEncoder().encode(`cody-gh-session:${secret}`)
}

/**
 * Create a signed JWT and set it as an httpOnly cookie on the response.
 */
export async function createCodySession(
  res: NextResponse,
  identity: CodyGitHubIdentity,
): Promise<void> {
  const secret = getSecret()
  const now = Math.floor(Date.now() / 1000)

  const token = await new SignJWT({
    login: identity.login,
    avatar_url: identity.avatar_url,
    githubId: identity.githubId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(secret)

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  }

  res.cookies.set(CODY_SESSION_COOKIE, token, cookieOptions)

  // Also set via Set-Cookie header for redirect responses (same pattern as oauth_cookies.ts)
  const sameSite = cookieOptions.secure ? 'Lax' : 'Lax'
  const parts = [
    `${CODY_SESSION_COOKIE}=${token}`,
    `Path=${cookieOptions.path}`,
    `Max-Age=${cookieOptions.maxAge}`,
    'HttpOnly',
    cookieOptions.secure ? 'Secure' : '',
    `SameSite=${sameSite}`,
  ].filter(Boolean)

  res.headers.append('Set-Cookie', parts.join('; '))
}

/**
 * Verify a raw session token string.
 * Used by both verifyCodySession (API routes) and verifyCodySessionToken (Server Components).
 */
async function verifyToken(token: string): Promise<CodyGitHubIdentity | null> {
  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    const p = payload as unknown as CodySessionPayload

    if (!p.login || !p.avatar_url || !p.githubId) return null

    return {
      login: p.login,
      avatar_url: p.avatar_url,
      githubId: p.githubId,
    }
  } catch {
    return null
  }
}

/**
 * Verify the session cookie on an incoming NextRequest (API routes).
 * Returns the identity payload, or null if missing/invalid/expired.
 */
export async function verifyCodySession(req: NextRequest): Promise<CodyGitHubIdentity | null> {
  const token = req.cookies.get(CODY_SESSION_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

/**
 * Verify a raw session token string (for use in Server Components via next/headers cookies()).
 */
export async function verifyCodySessionToken(
  token: string | undefined,
): Promise<CodyGitHubIdentity | null> {
  if (!token) return null
  return verifyToken(token)
}

/**
 * Clear the session cookie (logout).
 */
export function clearCodySession(res: NextResponse): void {
  res.cookies.set(CODY_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

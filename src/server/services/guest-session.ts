/**
 * Guest Session Service
 * Token generation, cookie management, and session CRUD operations
 *
 * @fileType service
 * @domain auth
 * @pattern session-management
 * @ai-summary Guest session lifecycle: create, validate, extend, revoke
 *
 * Security:
 * - Tokens are cryptographically random (32 bytes)
 * - Only tokenHash is stored in DB (S1)
 * - Cookies are HttpOnly, Secure (prod), SameSite=Lax (S2)
 */

import type { Payload } from 'payload'
import type { GuestSession } from '@/payload-types'
import crypto from 'crypto'
import { logger } from '@/infra/utils/logger'
import { getGuestChatConfig } from '@/server/config/guest-chat-config'

export const GUEST_SESSION_COOKIE_NAME = 'guest_session'

export type GuestSessionDoc = GuestSession

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function verifyTokenHash(storedHash: string, token: string): boolean {
  const computedHash = hashToken(token)
  try {
    const storedBuffer = Uint8Array.from(Buffer.from(storedHash))
    const tokenBuffer = Uint8Array.from(Buffer.from(computedHash))
    return crypto.timingSafeEqual(storedBuffer, tokenBuffer)
  } catch {
    return false
  }
}

export async function buildGuestSessionCookieHeader(token: string): Promise<string> {
  const guestConfig = await getGuestChatConfig()
  const maxAge = guestConfig.hard_cap_days * 24 * 60 * 60
  return [
    `${GUEST_SESSION_COOKIE_NAME}=${token}`,
    'HttpOnly',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join('; ')
}

export function buildClearGuestSessionCookieHeader(): string {
  return [
    `${GUEST_SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
  ]
    .filter(Boolean)
    .join('; ')
}

export async function setGuestSessionCookie(
  token: string,
  headers: Headers = new Headers(),
): Promise<void> {
  const guestConfig = await getGuestChatConfig()
  const maxAge = guestConfig.hard_cap_days * 24 * 60 * 60

  headers.append(
    'Set-Cookie',
    [
      `${GUEST_SESSION_COOKIE_NAME}=${token}`,
      'HttpOnly',
      process.env.NODE_ENV === 'production' ? 'Secure' : '',
      'SameSite=Lax',
      'Path=/',
      `Max-Age=${maxAge}`,
    ]
      .filter(Boolean)
      .join('; '),
  )
}

export function getGuestSessionCookie(headers: Headers): string | null {
  if (!headers) return null
  const cookieHeader = headers.get('cookie')
  if (!cookieHeader) return null

  const match = cookieHeader.match(new RegExp(`${GUEST_SESSION_COOKIE_NAME}=([^;]+)`))
  return match?.[1] || null
}

export function clearGuestSessionCookie(headers: Headers = new Headers()): void {
  headers.append(
    'Set-Cookie',
    [
      `${GUEST_SESSION_COOKIE_NAME}=`,
      'HttpOnly',
      process.env.NODE_ENV === 'production' ? 'Secure' : '',
      'SameSite=Lax',
      'Path=/',
      'Max-Age=0',
    ]
      .filter(Boolean)
      .join('; '),
  )
}

export async function createGuestSession(
  payload: Payload,
  options: {
    ipHash?: string
    userAgentHash?: string
  },
): Promise<{ session: GuestSessionDoc; token: string }> {
  const token = generateSessionToken()
  const tokenHash = hashToken(token)
  const now = new Date()

  const guestConfig = await getGuestChatConfig()
  const hardExpiresAt = new Date(now)
  hardExpiresAt.setDate(hardExpiresAt.getDate() + guestConfig.hard_cap_days)

  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + guestConfig.sliding_ttl_days)

  const session = await payload.create({
    collection: 'guest-sessions',
    data: {
      tokenHash,
      tokenVersion: 1,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      hardExpiresAt: hardExpiresAt.toISOString(),
      status: 'active',
      messageCount: 0,
      ipHash: options.ipHash,
      userAgentHash: options.userAgentHash,
    },
    draft: false,
  })

  logger.info({ sessionId: session.id }, 'Created guest session')

  return { session, token }
}

export async function getGuestSessionByToken(
  payload: Payload,
  token: string,
): Promise<GuestSessionDoc | null> {
  const tokenHash = hashToken(token)

  const sessions = await payload.find({
    collection: 'guest-sessions',
    where: {
      and: [{ tokenHash: { equals: tokenHash } }, { status: { equals: 'active' } }],
    },
    limit: 1,
  })

  if (sessions.docs.length === 0) return null

  const session = sessions.docs[0]

  if (new Date(session.expiresAt) < new Date()) {
    return null
  }

  return session
}

export async function updateGuestSessionActivity(
  payload: Payload,
  sessionId: string,
): Promise<GuestSessionDoc | null> {
  const session = await payload.findByID({
    collection: 'guest-sessions',
    id: sessionId,
  })

  if (!session || session.status !== 'active') {
    return null
  }

  const hardExpiresAt = new Date(session.hardExpiresAt)
  const now = new Date()

  const guestConfig = await getGuestChatConfig()
  const newExpiresAt = new Date(now)
  newExpiresAt.setDate(newExpiresAt.getDate() + guestConfig.sliding_ttl_days)

  if (newExpiresAt > hardExpiresAt) {
    newExpiresAt.setTime(hardExpiresAt.getTime())
  }

  const updated = await payload.update({
    collection: 'guest-sessions',
    id: sessionId,
    data: {
      lastActiveAt: now.toISOString(),
      expiresAt: newExpiresAt.toISOString(),
    },
  })

  return updated
}

export async function revokeGuestSession(
  payload: Payload,
  sessionId: string,
  claimedByUser: string,
): Promise<GuestSessionDoc | null> {
  const updated = await payload.update({
    collection: 'guest-sessions',
    id: sessionId,
    data: {
      status: 'revoked',
      claimedByUser,
      claimedAt: new Date().toISOString(),
    },
  })

  return updated
}

export interface GuestMessageLimitResult {
  allowed: boolean
  remaining: number
  current: number
  max: number
}

export async function checkAndIncrementGuestMessageCount(
  payload: Payload,
  guestSessionId: string,
): Promise<GuestMessageLimitResult> {
  const guestConfig = await getGuestChatConfig()

  const session = await payload.findByID({
    collection: 'guest-sessions',
    id: guestSessionId,
  })

  if (!session) {
    return { allowed: false, remaining: 0, current: 0, max: guestConfig.max_messages }
  }

  const currentCount = session.messageCount ?? 0

  if (currentCount >= guestConfig.max_messages) {
    return {
      allowed: false,
      remaining: 0,
      current: currentCount,
      max: guestConfig.max_messages,
    }
  }

  await payload.update({
    collection: 'guest-sessions',
    id: guestSessionId,
    data: {
      messageCount: currentCount + 1,
    },
  })

  return {
    allowed: true,
    remaining: guestConfig.max_messages - currentCount - 1,
    current: currentCount + 1,
    max: guestConfig.max_messages,
  }
}

export function hashIP(ip: string | null): string {
  if (!ip) return ''
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

export function hashUserAgent(ua: string | null): string {
  if (!ua) return ''
  return crypto.createHash('sha256').update(ua).digest('hex').slice(0, 16)
}

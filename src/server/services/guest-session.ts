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
import { getPayload } from 'payload'
import config from '@payload-config'
import crypto from 'crypto'
import { logger } from '@/infra/utils/logger'
import {
  GUEST_SESSION_SLIDING_TTL_DAYS,
  GUEST_SESSION_HARD_CAP_DAYS,
} from '@/server/config/constants'

export const GUEST_SESSION_COOKIE_NAME = 'guest_session'

export interface GuestSessionDoc {
  id: string
  tokenHash: string
  tokenVersion: number
  createdAt: string
  lastActiveAt: string
  expiresAt: string
  hardExpiresAt: string
  status: 'active' | 'expired' | 'revoked'
  claimedByUser?: string
  claimedAt?: string
}

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

export function buildGuestSessionCookieHeader(token: string): string {
  const maxAge = GUEST_SESSION_HARD_CAP_DAYS * 24 * 60 * 60
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

export function setGuestSessionCookie(token: string, headers: Headers = new Headers()): void {
  const maxAge = GUEST_SESSION_HARD_CAP_DAYS * 24 * 60 * 60

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

export async function createGuestSession(options: {
  req?: Request
  ipHash?: string
  userAgentHash?: string
}): Promise<{ session: GuestSessionDoc; token: string }> {
  const payload = await getPayload({ config })
  const token = generateSessionToken()
  const tokenHash = hashToken(token)
  const now = new Date()

  const hardExpiresAt = new Date(now)
  hardExpiresAt.setDate(hardExpiresAt.getDate() + GUEST_SESSION_HARD_CAP_DAYS)

  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + GUEST_SESSION_SLIDING_TTL_DAYS)

  const session = await payload.create({
    collection: 'guest-sessions' as any,
    data: {
      tokenHash,
      tokenVersion: 1,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      hardExpiresAt: hardExpiresAt.toISOString(),
      status: 'active',
      ipHash: options.ipHash,
      userAgentHash: options.userAgentHash,
    },
  })

  logger.info({ sessionId: session.id }, 'Created guest session')

  return { session: session as GuestSessionDoc, token }
}

export async function getGuestSessionByToken(token: string): Promise<GuestSessionDoc | null> {
  const payload = await getPayload({ config })
  const tokenHash = hashToken(token)

  const sessions = await payload.find({
    collection: 'guest-sessions' as any,
    where: {
      and: [{ tokenHash: { equals: tokenHash } }, { status: { equals: 'active' } }],
    },
    limit: 1,
  })

  if (sessions.docs.length === 0) return null

  const session = sessions.docs[0] as GuestSessionDoc

  if (new Date(session.expiresAt) < new Date()) {
    return null
  }

  return session
}

export async function updateGuestSessionActivity(
  sessionId: string,
): Promise<GuestSessionDoc | null> {
  const payload = await getPayload({ config })

  const session = await payload.findByID({
    collection: 'guest-sessions' as any,
    id: sessionId,
  })

  if (!session || (session as GuestSessionDoc).status !== 'active') {
    return null
  }

  const doc = session as GuestSessionDoc
  const hardExpiresAt = new Date(doc.hardExpiresAt)
  const now = new Date()

  const newExpiresAt = new Date(now)
  newExpiresAt.setDate(newExpiresAt.getDate() + GUEST_SESSION_SLIDING_TTL_DAYS)

  if (newExpiresAt > hardExpiresAt) {
    newExpiresAt.setTime(hardExpiresAt.getTime())
  }

  const updated = await payload.update({
    collection: 'guest-sessions' as any,
    id: sessionId,
    data: {
      lastActiveAt: now.toISOString(),
      expiresAt: newExpiresAt.toISOString(),
    },
  })

  return updated as GuestSessionDoc
}

export async function revokeGuestSession(
  sessionId: string,
  claimedByUser: string,
): Promise<GuestSessionDoc | null> {
  const payload = await getPayload({ config })

  const updated = await payload.update({
    collection: 'guest-sessions' as any,
    id: sessionId,
    data: {
      status: 'revoked',
      claimedByUser,
      claimedAt: new Date().toISOString(),
    },
  })

  return updated as GuestSessionDoc
}

export function hashIP(ip: string | null): string {
  if (!ip) return ''
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

export function hashUserAgent(ua: string | null): string {
  if (!ua) return ''
  return crypto.createHash('sha256').update(ua).digest('hex').slice(0, 16)
}

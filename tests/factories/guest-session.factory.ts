/**
 * Guest Session Factory
 * Creates test guest sessions with controllable state for testing
 *
 * @fileType test-factory
 * @domain auth
 * @pattern test-factory, guest-session
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Payload } from 'payload'
import crypto from 'crypto'
import type { TestDataTracker } from '../helpers/test-data-tracker'

export interface GuestSessionFactoryInput {
  status?: 'active' | 'expired' | 'revoked'
  expiresAt?: Date
  hardExpiresAt?: Date
  claimedByUser?: string
  ipHash?: string
  userAgentHash?: string
}

export interface GuestSessionResult {
  session: {
    id: string
    tokenHash: string
    tokenVersion: number
    createdAt: string
    lastActiveAt: string
    expiresAt: string
    hardExpiresAt: string
    status: string
    claimedByUser?: string
    claimedAt?: string
  }
  token: string
}

/**
 * Build guest session data without creating in DB
 */
export function buildGuestSessionData(input: GuestSessionFactoryInput = {}) {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const now = new Date()

  return {
    token,
    tokenHash,
    data: {
      tokenHash,
      tokenVersion: 1,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: (input.expiresAt ?? new Date(now.getTime() + 7 * 86400000)).toISOString(), // 7 days default
      hardExpiresAt: (input.hardExpiresAt ?? new Date(now.getTime() + 30 * 86400000)).toISOString(), // 30 days default
      status: input.status ?? 'active',
      claimedByUser: input.claimedByUser,
      messageCount: 0,
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
    },
  }
}

/**
 * Create guest session in database
 */
export async function createGuestSession(
  payload: Payload,
  input: GuestSessionFactoryInput = {},
  tracker?: TestDataTracker,
): Promise<GuestSessionResult> {
  const { token, data } = buildGuestSessionData(input)

  const session = await payload.create({
    collection: 'guest-sessions',
    data,
    overrideAccess: true,
    draft: false,
  })

  tracker?.track('guest-sessions', session.id)

  return {
    session: session as GuestSessionResult['session'],
    token,
  }
}

/**
 * Create expired guest session (for cleanup tests)
 */
export async function createExpiredGuestSession(
  payload: Payload,
  hoursAgo: number = 1,
): Promise<GuestSessionResult> {
  const expiredAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
  return createGuestSession(payload, {
    status: 'active', // Still marked active, just expired
    expiresAt: expiredAt,
  })
}

/**
 * Create guest session with manual DB insert (for edge cases)
 * This bypasses any validation hooks
 */
export async function createGuestSessionRaw(
  payload: Payload,
  input: GuestSessionFactoryInput = {},
): Promise<GuestSessionResult> {
  const { token, tokenHash: _tokenHash, data } = buildGuestSessionData(input)

  // Use direct MongoDB insert to bypass any hooks
  const db = payload.db as any
  const collection = db.collection('guest-sessions')

  await collection.insertOne({
    ...data,
    _id: data.tokenHash, // Use tokenHash as ID for simplicity
    updatedAt: new Date(),
    createdAt: new Date(),
  })

  return {
    session: {
      id: data.tokenHash,
      ...data,
    } as GuestSessionResult['session'],
    token,
  }
}

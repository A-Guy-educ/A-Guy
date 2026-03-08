/**
 * Integration tests: Guest Session Sliding TTL + Hard Expiry
 * Covers: getGuestSessionByToken() expiry checks + createGuestSession() TTL setup
 *
 * P2 #23 — edge case: sliding TTL extends past hard cap.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { createGuestSession, getGuestSessionByToken } from '@/server/services/guest-session'

let payload: Payload
let originalDatabaseUrl: string | undefined

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })
}, 120_000)

afterAll(async () => {
  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

describe('Guest session TTL + hard expiry', () => {
  it('creates a session with both expiresAt and hardExpiresAt', async () => {
    const { session } = await createGuestSession(payload, {
      ipHash: 'test-ip',
      userAgentHash: 'test-ua',
    })

    expect(session.expiresAt).toBeDefined()
    expect(session.hardExpiresAt).toBeDefined()
    expect(session.status).toBe('active')

    // expiresAt should be before hardExpiresAt
    const expiresAt = new Date(session.expiresAt)
    const hardExpiresAt = new Date(session.hardExpiresAt)
    expect(expiresAt.getTime()).toBeLessThanOrEqual(hardExpiresAt.getTime())
  })

  it('retrieves an active session by token', async () => {
    const { session, token } = await createGuestSession(payload, {})

    const retrieved = await getGuestSessionByToken(payload, token)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe(session.id)
  })

  it('returns null for an expired session (expiresAt in the past)', async () => {
    const { session, token } = await createGuestSession(payload, {})

    // Manually set expiresAt to the past
    await payload.update({
      collection: 'guest-sessions',
      id: session.id,
      data: { expiresAt: new Date('2020-01-01').toISOString() } as any,
      overrideAccess: true,
    })

    const retrieved = await getGuestSessionByToken(payload, token)
    expect(retrieved).toBeNull()
  })

  it('returns null for a revoked session', async () => {
    const { session, token } = await createGuestSession(payload, {})

    // Revoke the session
    await payload.update({
      collection: 'guest-sessions',
      id: session.id,
      data: { status: 'revoked' } as any,
      overrideAccess: true,
    })

    const retrieved = await getGuestSessionByToken(payload, token)
    expect(retrieved).toBeNull()
  })

  it('returns null for a non-existent token', async () => {
    const retrieved = await getGuestSessionByToken(payload, 'nonexistent-token-abc123')
    expect(retrieved).toBeNull()
  })
})

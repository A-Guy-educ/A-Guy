/**
 * Integration tests: Cron — Guest Sessions Cleanup
 * Covers: guestSessionsCleanupEndpoint handler
 *
 * P0 — PII leak + DB bloat: expired guest sessions never purged without this cron.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { guestSessionsCleanupEndpoint } from '@/server/payload/endpoints/cron/guest-sessions-cleanup'
import { createGuestSession } from '../factories/guest-session.factory'

const TEST_CRON_SECRET = 'test-cron-secret-cleanup-99'

let payload: Payload
let originalDatabaseUrl: string | undefined
let originalCronSecret: string | undefined

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  originalCronSecret = process.env.CRON_SECRET
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL
  process.env.CRON_SECRET = TEST_CRON_SECRET

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
  if (originalCronSecret !== undefined) {
    process.env.CRON_SECRET = originalCronSecret
  } else {
    delete process.env.CRON_SECRET
  }
}, 120_000)

beforeEach(async () => {
  const gs = await payload.find({ collection: 'guest-sessions', limit: 1000, overrideAccess: true })
  for (const s of gs.docs)
    await payload.delete({ collection: 'guest-sessions', id: s.id, overrideAccess: true })
  const convs = await payload.find({
    collection: 'conversations',
    limit: 1000,
    overrideAccess: true,
  })
  for (const c of convs.docs)
    await payload.delete({ collection: 'conversations', id: c.id, overrideAccess: true })
})

function makeReq(authHeader?: string): PayloadRequest {
  return {
    payload,
    headers: {
      get: (name: string) => (name === 'authorization' ? (authHeader ?? null) : null),
    },
  } as unknown as PayloadRequest
}

describe('guestSessionsCleanupEndpoint', () => {
  describe('authentication', () => {
    it('returns 401 with no auth header', async () => {
      const res = await guestSessionsCleanupEndpoint.handler(makeReq())
      expect(res.status).toBe(401)
    })

    it('returns 401 with wrong secret', async () => {
      const res = await guestSessionsCleanupEndpoint.handler(makeReq('Bearer wrong-secret'))
      expect(res.status).toBe(401)
    })

    it('returns 401 when Bearer prefix is missing', async () => {
      const res = await guestSessionsCleanupEndpoint.handler(makeReq(TEST_CRON_SECRET))
      expect(res.status).toBe(401)
    })

    it('returns 200 with valid auth and no sessions to clean', async () => {
      const res = await guestSessionsCleanupEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })

  describe('cleanup logic', () => {
    it('deletes revoked (claimed) guest sessions', async () => {
      const { session } = await createGuestSession(payload, { status: 'revoked' })

      const res = await guestSessionsCleanupEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.claimedSessionsDeleted).toBeGreaterThanOrEqual(1)

      const check = await payload.find({
        collection: 'guest-sessions',
        where: { id: { equals: session.id } },
        overrideAccess: true,
      })
      expect(check.docs).toHaveLength(0)
    })

    it('deletes hard-expired guest sessions', async () => {
      // hardExpiresAt set way in the past (beyond any hard_cap_days config)
      const pastDate = new Date(Date.now() - 999 * 24 * 60 * 60 * 1000)
      const { session } = await createGuestSession(payload, {
        status: 'active',
        hardExpiresAt: pastDate,
      })

      const res = await guestSessionsCleanupEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.expiredSessionsDeleted).toBeGreaterThanOrEqual(1)

      const check = await payload.find({
        collection: 'guest-sessions',
        where: { id: { equals: session.id } },
        overrideAccess: true,
      })
      expect(check.docs).toHaveLength(0)
    })

    it('does not delete active non-expired sessions', async () => {
      const { session } = await createGuestSession(payload, { status: 'active' })

      const res = await guestSessionsCleanupEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.expiredSessionsDeleted).toBe(0)
      expect(body.claimedSessionsDeleted).toBe(0)

      const check = await payload.find({
        collection: 'guest-sessions',
        where: { id: { equals: session.id } },
        overrideAccess: true,
      })
      expect(check.docs).toHaveLength(1)
    })

    it('response includes all expected stat fields', async () => {
      const res = await guestSessionsCleanupEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      const body = await res.json()
      expect(typeof body.expiredSessionsDeleted).toBe('number')
      expect(typeof body.claimedSessionsDeleted).toBe('number')
      expect(typeof body.orphanedConversationsDeleted).toBe('number')
      expect(typeof body.failedSessionDeletions).toBe('number')
      expect(typeof body.hasMore).toBe('boolean')
      expect(body.timestamp).toBeDefined()
    })
  })
})

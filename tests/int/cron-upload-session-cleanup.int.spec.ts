/**
 * Integration tests: Cron — Upload Session Cleanup
 * Covers: uploadSessionCleanupEndpoint handler
 *
 * P0 — data consistency: abandoned upload sessions accumulate and block reuse.
 * Blob deletion is mocked (no BLOB_READ_WRITE_TOKEN needed).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { uploadSessionCleanupEndpoint } from '@/server/payload/endpoints/cron/upload-session-cleanup'

vi.mock('@vercel/blob', () => ({
  del: vi.fn().mockResolvedValue(undefined),
}))

const TEST_CRON_SECRET = 'test-cron-secret-upload-55'

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
  const sessions = await payload.find({
    collection: 'upload-sessions',
    limit: 1000,
    overrideAccess: true,
  })
  for (const s of sessions.docs)
    await payload.delete({ collection: 'upload-sessions', id: s.id, overrideAccess: true })
})

function makeReq(authHeader?: string): PayloadRequest {
  return {
    payload,
    headers: {
      get: (name: string) => (name === 'authorization' ? (authHeader ?? null) : null),
    },
  } as unknown as PayloadRequest
}

async function createUploadSession(opts: {
  status?: 'initiated' | 'uploaded' | 'finalized' | 'cancelled' | 'failed'
  expiresAt?: string
}) {
  const ts = Date.now()
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  return payload.create({
    collection: 'upload-sessions',
    data: {
      status: opts.status ?? 'initiated',
      expiresAt: opts.expiresAt ?? past,
      originalFilename: `test-${ts}.jpg`,
      pathname: `uploads/test/test-${ts}.jpg`,
      mimeType: 'image/jpeg',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    overrideAccess: true,
  })
}

describe('uploadSessionCleanupEndpoint', () => {
  describe('authentication', () => {
    it('returns 401 with no auth header', async () => {
      const res = await uploadSessionCleanupEndpoint.handler(makeReq())
      expect(res.status).toBe(401)
    })

    it('returns 401 with wrong secret', async () => {
      const res = await uploadSessionCleanupEndpoint.handler(makeReq('Bearer bad'))
      expect(res.status).toBe(401)
    })

    it('returns 200 with valid auth and nothing to clean', async () => {
      const res = await uploadSessionCleanupEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.deletedSessions).toBe(0)
    })
  })

  describe('cleanup logic', () => {
    it.each(['initiated', 'uploaded', 'failed', 'cancelled'] as const)(
      'deletes expired %s session',
      async (status) => {
        const session = await createUploadSession({ status })

        const res = await uploadSessionCleanupEndpoint.handler(
          makeReq(`Bearer ${TEST_CRON_SECRET}`),
        )
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.deletedSessions).toBeGreaterThanOrEqual(1)

        const check = await payload.find({
          collection: 'upload-sessions',
          where: { id: { equals: session.id } },
          overrideAccess: true,
        })
        expect(check.docs).toHaveLength(0)
      },
    )

    it('does not delete non-expired sessions', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const session = await createUploadSession({ status: 'initiated', expiresAt: futureDate })

      const res = await uploadSessionCleanupEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      const body = await res.json()
      expect(body.deletedSessions).toBe(0)

      const check = await payload.find({
        collection: 'upload-sessions',
        where: { id: { equals: session.id } },
        overrideAccess: true,
      })
      expect(check.docs).toHaveLength(1)
    })

    it('does not delete finalized sessions even if expired', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const session = await createUploadSession({ status: 'finalized', expiresAt: pastDate })

      const res = await uploadSessionCleanupEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      const body = await res.json()
      expect(body.deletedSessions).toBe(0)

      const check = await payload.find({
        collection: 'upload-sessions',
        where: { id: { equals: session.id } },
        overrideAccess: true,
      })
      expect(check.docs).toHaveLength(1)
    })

    it('response includes deletedSessions and failedDeletions', async () => {
      const res = await uploadSessionCleanupEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      const body = await res.json()
      expect(typeof body.deletedSessions).toBe('number')
      expect(typeof body.failedDeletions).toBe('number')
      expect(body.timestamp).toBeDefined()
    })
  })
})

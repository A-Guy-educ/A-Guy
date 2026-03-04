/**
 * Integration tests: Cron — Chat Asset Expiry
 * Covers: chatAssetExpiryEndpoint handler
 *
 * P0 — cost/privacy: orphaned ephemeral blobs never removed without this cron.
 * Blob deletion is mocked (no BLOB_READ_WRITE_TOKEN needed).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { chatAssetExpiryEndpoint } from '@/server/payload/endpoints/cron/chat-asset-expiry'

// Mock Vercel Blob so tests run without real credentials
vi.mock('@vercel/blob', () => ({
  del: vi.fn().mockResolvedValue(undefined),
}))

const TEST_CRON_SECRET = 'test-cron-secret-chat-asset-77'

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
  const assets = await payload.find({
    collection: 'chat-assets',
    limit: 1000,
    overrideAccess: true,
  })
  for (const a of assets.docs)
    await payload.delete({ collection: 'chat-assets', id: a.id, overrideAccess: true })
})

function makeReq(authHeader?: string): PayloadRequest {
  return {
    payload,
    headers: {
      get: (name: string) => (name === 'authorization' ? (authHeader ?? null) : null),
    },
  } as unknown as PayloadRequest
}

async function createChatAsset(opts: {
  retentionPolicy?: 'ephemeral' | 'persistent'
  expiresAt?: string
  url?: string
}) {
  const ts = Date.now()
  return payload.create({
    collection: 'chat-assets',
    data: {
      url: opts.url ?? 'https://example.blob.vercel-storage.com/test-asset.jpg',
      originalFilename: `test-${ts}.jpg`,
      pathname: `uploads/chat/test-${ts}.jpg`,
      uploadSessionId: `test-session-${ts}`,
      mimeType: 'image/jpeg',
      filesize: 1024,
      retentionPolicy: opts.retentionPolicy ?? 'ephemeral',
      expiresAt: opts.expiresAt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    overrideAccess: true,
  })
}

describe('chatAssetExpiryEndpoint', () => {
  describe('authentication', () => {
    it('returns 401 with no auth header', async () => {
      const res = await chatAssetExpiryEndpoint.handler(makeReq())
      expect(res.status).toBe(401)
    })

    it('returns 401 with wrong secret', async () => {
      const res = await chatAssetExpiryEndpoint.handler(makeReq('Bearer wrong'))
      expect(res.status).toBe(401)
    })

    it('returns 200 with valid auth', async () => {
      const res = await chatAssetExpiryEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })

  describe('cleanup logic', () => {
    it('deletes expired ephemeral assets from DB', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const asset = await createChatAsset({ retentionPolicy: 'ephemeral', expiresAt: pastDate })

      const res = await chatAssetExpiryEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.deletedAssets).toBeGreaterThanOrEqual(1)

      const check = await payload.find({
        collection: 'chat-assets',
        where: { id: { equals: asset.id } },
        overrideAccess: true,
      })
      expect(check.docs).toHaveLength(0)
    })

    it('does not delete non-expired ephemeral assets', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const asset = await createChatAsset({ retentionPolicy: 'ephemeral', expiresAt: futureDate })

      const res = await chatAssetExpiryEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      const body = await res.json()
      expect(body.deletedAssets).toBe(0)

      const check = await payload.find({
        collection: 'chat-assets',
        where: { id: { equals: asset.id } },
        overrideAccess: true,
      })
      expect(check.docs).toHaveLength(1)
    })

    it('does not delete persistent assets even if expiresAt is past', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const asset = await createChatAsset({ retentionPolicy: 'persistent', expiresAt: pastDate })

      const res = await chatAssetExpiryEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      const body = await res.json()
      expect(body.deletedAssets).toBe(0)

      const check = await payload.find({
        collection: 'chat-assets',
        where: { id: { equals: asset.id } },
        overrideAccess: true,
      })
      expect(check.docs).toHaveLength(1)
    })

    it('response includes deletedAssets and failedDeletions counts', async () => {
      const res = await chatAssetExpiryEndpoint.handler(makeReq(`Bearer ${TEST_CRON_SECRET}`))
      const body = await res.json()
      expect(typeof body.deletedAssets).toBe('number')
      expect(typeof body.failedDeletions).toBe('number')
      expect(body.timestamp).toBeDefined()
    })
  })
})

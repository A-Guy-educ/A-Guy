import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { mediaExpiryCleanupEndpoint } from '@/server/payload/endpoints/cron/media-expiry'
import { createTestUser } from '../factories/user.factory'

let payload: Payload
let originalDatabaseUrl: string | undefined
let originalCronSecret: string | undefined
let testUserId: string
let testTenantId: string

const TEST_CRON_SECRET = 'test-cron-secret-12345'

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  originalCronSecret = process.env.CRON_SECRET

  // @ts-expect-error - TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL
  process.env.CRON_SECRET = TEST_CRON_SECRET

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create test user and tenant
  const user = await createTestUser(payload)
  testUserId = user.id

  // Get or create test tenant
  const tenants = await payload.find({
    collection: 'tenants',
    limit: 1,
    overrideAccess: true,
  })

  if (tenants.docs.length > 0) {
    testTenantId = tenants.docs[0].id
  } else {
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Test Tenant',
        slug: 'test-tenant',
        status: 'active',
      },
      overrideAccess: true,
    })
    testTenantId = tenant.id
  }
}, 120000)

beforeEach(async () => {
  if (!payload) return

  // Clean up test media before each test (both ephemeral and persistent)
  const testMedia = await payload.find({
    collection: 'media',
    where: {
      or: [
        { retentionPolicy: { equals: 'ephemeral' } },
        { retentionPolicy: { equals: 'persistent' } },
      ],
    },
    limit: 1000,
    overrideAccess: true,
  })

  for (const media of testMedia.docs) {
    await payload.delete({
      collection: 'media',
      id: media.id,
      overrideAccess: true,
    })
  }
})

afterAll(async () => {
  if (payload && testUserId) {
    await payload.delete({ collection: 'users', id: testUserId, overrideAccess: true })
  }

  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error - TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }

  if (originalCronSecret !== undefined) {
    process.env.CRON_SECRET = originalCronSecret
  } else {
    delete process.env.CRON_SECRET
  }
}, 120000)

/**
 * Helper to create a mock PayloadRequest with authorization header
 */
function createCronRequest(authHeader?: string): PayloadRequest {
  return {
    payload,
    headers: {
      get: (name: string) => {
        if (name === 'authorization') return authHeader
        return null
      },
    },
  } as unknown as PayloadRequest
}

/**
 * Create a minimal 1x1 pixel JPEG buffer for testing
 * This is a valid JPEG that Payload's upload validation will accept
 */
function createTestImageBuffer(): Buffer {
  // Minimal valid 1x1 red JPEG (smallest possible valid JPEG)
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00,
    0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
    0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35,
    0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55,
    0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94,
    0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2,
    0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
    0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6,
    0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda,
    0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd5, 0xdb, 0x20, 0xa8, 0xf1, 0x45, 0x00,
    0xff, 0xd9,
  ])
}

/**
 * Helper to create a test media document with file upload
 */
async function createTestMedia(options: {
  filename?: string
  retentionPolicy?: 'ephemeral' | 'persistent'
  expiresAt?: string
}) {
  const filename = options.filename || `test-${Date.now()}.jpg`

  return payload.create(
    {
      collection: 'media',
      data: {
        tenant: testTenantId,
        retentionPolicy: options.retentionPolicy || 'ephemeral',
        expiresAt: options.expiresAt,
      },
      file: {
        data: createTestImageBuffer(),
        name: filename,
        mimetype: 'image/jpeg',
        size: 134,
      },
      overrideAccess: true,
      context: { allowRetentionPatch: true },
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  )
}

describe('Media Cleanup Endpoint', () => {
  describe('Authentication', () => {
    it('returns 401 when no authorization header is provided', async () => {
      const req = createCronRequest()
      const res = await mediaExpiryCleanupEndpoint.handler(req)

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('returns 401 when authorization header is invalid', async () => {
      const req = createCronRequest('Bearer wrong-secret')
      const res = await mediaExpiryCleanupEndpoint.handler(req)

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('returns 401 when authorization header format is wrong', async () => {
      const req = createCronRequest(TEST_CRON_SECRET) // Missing "Bearer " prefix
      const res = await mediaExpiryCleanupEndpoint.handler(req)

      expect(res.status).toBe(401)
    })

    it('returns 200 with valid authorization', async () => {
      const req = createCronRequest(`Bearer ${TEST_CRON_SECRET}`)
      const res = await mediaExpiryCleanupEndpoint.handler(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })

  describe('Cleanup Logic', () => {
    it('deletes expired ephemeral media', async () => {
      // Create expired media
      const expiredDate = new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1 hour ago
      const expiredMedia = await createTestMedia({
        filename: 'expired-test.jpg',
        retentionPolicy: 'ephemeral',
        expiresAt: expiredDate,
      })

      const req = createCronRequest(`Bearer ${TEST_CRON_SECRET}`)
      const res = await mediaExpiryCleanupEndpoint.handler(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.deletedCount).toBe(1)

      // Verify media was deleted
      const found = await payload.find({
        collection: 'media',
        where: { id: { equals: expiredMedia.id } },
        overrideAccess: true,
      })
      expect(found.docs.length).toBe(0)
    })

    it('does not delete non-expired ephemeral media', async () => {
      // Create non-expired media
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() // 24 hours from now
      const nonExpiredMedia = await createTestMedia({
        filename: 'non-expired-test.jpg',
        retentionPolicy: 'ephemeral',
        expiresAt: futureDate,
      })

      const req = createCronRequest(`Bearer ${TEST_CRON_SECRET}`)
      const res = await mediaExpiryCleanupEndpoint.handler(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.deletedCount).toBe(0)

      // Verify media still exists
      const found = await payload.find({
        collection: 'media',
        where: { id: { equals: nonExpiredMedia.id } },
        overrideAccess: true,
      })
      expect(found.docs.length).toBe(1)
    })

    it('does not delete persistent media', async () => {
      // Create permanent media with past expiresAt (should be ignored)
      const expiredDate = new Date(Date.now() - 1000 * 60 * 60).toISOString()
      const permanentMedia = await createTestMedia({
        filename: 'permanent-test.jpg',
        retentionPolicy: 'persistent',
        expiresAt: expiredDate,
      })

      const req = createCronRequest(`Bearer ${TEST_CRON_SECRET}`)
      const res = await mediaExpiryCleanupEndpoint.handler(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.deletedCount).toBe(0)

      // Verify media still exists
      const found = await payload.find({
        collection: 'media',
        where: { id: { equals: permanentMedia.id } },
        overrideAccess: true,
      })
      expect(found.docs.length).toBe(1)
    })

    it('handles multiple expired media documents', async () => {
      const expiredDate = new Date(Date.now() - 1000 * 60 * 60).toISOString()

      // Create multiple expired media in parallel
      await Promise.all([
        createTestMedia({
          filename: 'expired-1.jpg',
          retentionPolicy: 'ephemeral',
          expiresAt: expiredDate,
        }),
        createTestMedia({
          filename: 'expired-2.jpg',
          retentionPolicy: 'ephemeral',
          expiresAt: expiredDate,
        }),
        createTestMedia({
          filename: 'expired-3.jpg',
          retentionPolicy: 'ephemeral',
          expiresAt: expiredDate,
        }),
      ])

      const req = createCronRequest(`Bearer ${TEST_CRON_SECRET}`)
      const res = await mediaExpiryCleanupEndpoint.handler(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.deletedCount).toBe(3)
    })

    it('returns hasMore flag when more items exist', async () => {
      // This test is limited because we can't easily create 100+ records
      // Just verify the flag exists in response
      const req = createCronRequest(`Bearer ${TEST_CRON_SECRET}`)
      const res = await mediaExpiryCleanupEndpoint.handler(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(typeof body.hasMore).toBe('boolean')
    })

    it('includes timestamp in response', async () => {
      const req = createCronRequest(`Bearer ${TEST_CRON_SECRET}`)
      const res = await mediaExpiryCleanupEndpoint.handler(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.timestamp).toBeDefined()
      expect(new Date(body.timestamp).getTime()).toBeLessThanOrEqual(Date.now())
    })
  })
})

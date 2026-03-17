/**
 * Integration tests for Chat Asset Upload flow
 *
 * Tests the upload-token → upload-session → finalize pipeline
 * using real Payload + MongoDB (testcontainers).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { buildChatAssetPathname } from '@/server/chat-assets/pathname'
import {
  CHAT_ASSET_ALLOWED_MIME_TYPES,
  CHAT_ASSET_MAX_BYTES,
  CHAT_ASSET_RETENTION_DAYS,
  CHAT_ASSET_TOKEN_VALID_MINUTES,
} from '@/server/chat-assets/constants'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestUser } from '../factories/user.factory'

let payload: Payload
let originalDatabaseUrl: string | undefined
let testUserId: string
let testTenantId: string

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL

  // @ts-expect-error - TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Create test user
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

  // Clean up upload-sessions and chat-assets before each test
  const sessions = await payload.find({
    collection: 'upload-sessions',
    limit: 1000,
    overrideAccess: true,
  })
  for (const session of sessions.docs) {
    await payload.delete({
      collection: 'upload-sessions',
      id: session.id,
      overrideAccess: true,
    })
  }

  const assets = await payload.find({
    collection: 'chat-assets',
    limit: 1000,
    overrideAccess: true,
  })
  for (const asset of assets.docs) {
    await payload.delete({
      collection: 'chat-assets',
      id: asset.id,
      overrideAccess: true,
    })
  }
})

afterAll(async () => {
  if (payload && testUserId) {
    await payload.delete({ collection: 'users', id: testUserId, overrideAccess: true })
  }

  if (payload?.db?.destroy) {
    await payload.db.destroy()
  }

  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error - TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120000)

describe('Upload Session Creation', () => {
  it('creates an upload session with valid data', async () => {
    const expiresAt = new Date(Date.now() + CHAT_ASSET_TOKEN_VALID_MINUTES * 60 * 1000)

    const session = await payload.create({
      collection: 'upload-sessions',
      data: {
        tenant: testTenantId,
        createdBy: testUserId,
        purpose: 'chat-media',
        originalFilename: 'test-document.pdf',
        mimeType: 'application/pdf',
        expectedSize: 1024,
        pathname: 'chat-assets/test/path/test-document.pdf',
        status: 'initiated',
        expiresAt: expiresAt.toISOString(),
      },
      overrideAccess: true,
    })

    expect(session.id).toBeDefined()
    expect(session.status).toBe('initiated')
    expect(session.originalFilename).toBe('test-document.pdf')
    expect(session.mimeType).toBe('application/pdf')
    expect(session.pathname).toBe('chat-assets/test/path/test-document.pdf')
  })

  it('requires pathname to be non-empty', async () => {
    const expiresAt = new Date(Date.now() + 60_000)

    await expect(
      payload.create({
        collection: 'upload-sessions',
        data: {
          tenant: testTenantId,
          createdBy: testUserId,
          purpose: 'chat-media',
          originalFilename: 'test.pdf',
          mimeType: 'application/pdf',
          expectedSize: 1024,
          pathname: '',
          status: 'initiated',
          expiresAt: expiresAt.toISOString(),
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('transitions from initiated to uploaded status', async () => {
    const session = await payload.create({
      collection: 'upload-sessions',
      data: {
        tenant: testTenantId,
        createdBy: testUserId,
        purpose: 'chat-media',
        originalFilename: 'photo.jpg',
        mimeType: 'image/jpeg',
        expectedSize: 5000,
        pathname: 'chat-assets/test/path/photo.jpg',
        status: 'initiated',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      overrideAccess: true,
    })

    const updated = await payload.update({
      collection: 'upload-sessions',
      id: session.id,
      data: {
        blobUrl: 'https://example.blob.vercel-storage.com/chat-assets/test/path/photo.jpg',
        status: 'uploaded',
      },
      overrideAccess: true,
    })

    expect(updated.status).toBe('uploaded')
    expect(updated.blobUrl).toContain('vercel-storage.com')
  })
})

describe('Chat Asset Finalization', () => {
  it('creates a chat asset from a completed upload session', async () => {
    const blobUrl = `https://example.blob.vercel-storage.com/chat-assets/${testTenantId}/${testUserId}/sess-123/table.pdf`

    const session = await payload.create({
      collection: 'upload-sessions',
      data: {
        tenant: testTenantId,
        createdBy: testUserId,
        purpose: 'chat-media',
        originalFilename: 'table.pdf',
        mimeType: 'application/pdf',
        expectedSize: 2048,
        pathname: `chat-assets/${testTenantId}/${testUserId}/sess-123/table.pdf`,
        status: 'uploaded',
        blobUrl,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      overrideAccess: true,
    })

    const expiresAt = new Date(Date.now() + CHAT_ASSET_RETENTION_DAYS * 24 * 60 * 60 * 1000)

    const chatAsset = await payload.create({
      collection: 'chat-assets',
      data: {
        tenant: testTenantId,
        createdBy: testUserId,
        url: blobUrl,
        pathname: session.pathname,
        originalFilename: session.originalFilename,
        mimeType: session.mimeType,
        filesize: session.expectedSize || 0,
        retentionPolicy: 'ephemeral',
        expiresAt: expiresAt.toISOString(),
        uploadSessionId: session.id,
      },
      overrideAccess: true,
    })

    expect(chatAsset.id).toBeDefined()
    expect(chatAsset.url).toBe(blobUrl)
    expect(chatAsset.originalFilename).toBe('table.pdf')
    expect(chatAsset.mimeType).toBe('application/pdf')
    expect(chatAsset.filesize).toBe(2048)
    expect(chatAsset.retentionPolicy).toBe('ephemeral')
    expect(chatAsset.uploadSessionId).toBe(session.id)

    // Verify session can be marked as finalized
    const finalizedSession = await payload.update({
      collection: 'upload-sessions',
      id: session.id,
      data: {
        status: 'finalized',
        chatAssetId: chatAsset.id,
      },
      overrideAccess: true,
    })

    expect(finalizedSession.status).toBe('finalized')
  })

  it('enforces unique uploadSessionId on chat-assets', async () => {
    const sessionId = `unique-session-${Date.now()}`
    const blobUrl = `https://example.blob.vercel-storage.com/chat-assets/test/${sessionId}/file.jpg`

    await payload.create({
      collection: 'chat-assets',
      data: {
        tenant: testTenantId,
        createdBy: testUserId,
        url: blobUrl,
        pathname: `chat-assets/test/${sessionId}/file.jpg`,
        originalFilename: 'file.jpg',
        mimeType: 'image/jpeg',
        filesize: 1024,
        retentionPolicy: 'ephemeral',
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
        uploadSessionId: sessionId,
      },
      overrideAccess: true,
    })

    // Attempting to create a second asset with the same uploadSessionId should fail
    await expect(
      payload.create({
        collection: 'chat-assets',
        data: {
          tenant: testTenantId,
          createdBy: testUserId,
          url: blobUrl,
          pathname: `chat-assets/test/${sessionId}/file2.jpg`,
          originalFilename: 'file2.jpg',
          mimeType: 'image/jpeg',
          filesize: 2048,
          retentionPolicy: 'ephemeral',
          expiresAt: new Date(Date.now() + 86400_000).toISOString(),
          uploadSessionId: sessionId,
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})

describe('Session Lookup Strategies', () => {
  it('finds session by blobUrl', async () => {
    const blobUrl = `https://example.blob.vercel-storage.com/chat-assets/lookup-test-${Date.now()}.pdf`

    await payload.create({
      collection: 'upload-sessions',
      data: {
        tenant: testTenantId,
        createdBy: testUserId,
        purpose: 'chat-media',
        originalFilename: 'lookup-test.pdf',
        mimeType: 'application/pdf',
        expectedSize: 1024,
        pathname: 'chat-assets/test/lookup-test.pdf',
        status: 'uploaded',
        blobUrl,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      overrideAccess: true,
    })

    const result = await payload.find({
      collection: 'upload-sessions',
      where: { blobUrl: { equals: blobUrl } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs[0].originalFilename).toBe('lookup-test.pdf')
  })

  it('finds session by createdBy + originalFilename + status', async () => {
    const filename = `fallback-test-${Date.now()}.pdf`

    await payload.create({
      collection: 'upload-sessions',
      data: {
        tenant: testTenantId,
        createdBy: testUserId,
        purpose: 'chat-media',
        originalFilename: filename,
        mimeType: 'application/pdf',
        expectedSize: 1024,
        pathname: `chat-assets/test/${filename}`,
        status: 'initiated',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      overrideAccess: true,
    })

    // This simulates the strategy 3 fallback in finalize
    const result = await payload.find({
      collection: 'upload-sessions',
      where: {
        createdBy: { equals: testUserId },
        status: { in: ['initiated', 'uploaded'] },
        originalFilename: { equals: filename },
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs[0].originalFilename).toBe(filename)
  })

  it('does not find finalized sessions in fallback lookup', async () => {
    const filename = `finalized-test-${Date.now()}.pdf`

    await payload.create({
      collection: 'upload-sessions',
      data: {
        tenant: testTenantId,
        createdBy: testUserId,
        purpose: 'chat-media',
        originalFilename: filename,
        mimeType: 'application/pdf',
        expectedSize: 1024,
        pathname: `chat-assets/test/${filename}`,
        status: 'finalized',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      overrideAccess: true,
    })

    const result = await payload.find({
      collection: 'upload-sessions',
      where: {
        createdBy: { equals: testUserId },
        status: { in: ['initiated', 'uploaded'] },
        originalFilename: { equals: filename },
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    expect(result.docs).toHaveLength(0)
  })
})

describe('Pathname Builder', () => {
  it('builds correct pathname format', () => {
    const pathname = buildChatAssetPathname({
      tenantId: 'tenant-123',
      userId: 'user-456',
      uploadSessionId: 'session-789',
      filename: 'test document.pdf',
    })

    expect(pathname).toMatch(/^chat-assets\/tenant-123\/user-456\/session-789\//)
    expect(pathname).not.toContain(' ') // Spaces should be sanitized
  })

  it('handles special characters in filename', () => {
    const pathname = buildChatAssetPathname({
      tenantId: 'tenant-1',
      userId: 'user-1',
      uploadSessionId: 'sess-1',
      filename: 'résumé (final).pdf',
    })

    expect(pathname).toMatch(/^chat-assets\//)
    expect(pathname).not.toContain('(')
    expect(pathname).not.toContain(')')
    expect(pathname).not.toContain(' ')
  })

  it('handles empty filename gracefully', () => {
    const pathname = buildChatAssetPathname({
      tenantId: 'tenant-1',
      userId: 'user-1',
      uploadSessionId: 'sess-1',
      filename: '',
    })

    expect(pathname).toContain('chat-assets/tenant-1/user-1/sess-1/')
  })
})

describe('Media Upload with File', () => {
  /**
   * Create a minimal valid JPEG buffer for testing
   */
  function createTestImageBuffer(): Buffer {
    return Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06,
      0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b,
      0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31,
      0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff,
      0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00,
      0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
      0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03, 0x03, 0x02, 0x04, 0x03, 0x05, 0x05,
      0x04, 0x04, 0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21,
      0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
      0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a,
      0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36, 0x37,
      0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56,
      0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
      0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93,
      0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9,
      0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6,
      0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
      0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7,
      0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd5,
      0xdb, 0x20, 0xa8, 0xf1, 0x45, 0x00, 0xff, 0xd9,
    ])
  }

  it('uploads media with actual file data via Payload', async () => {
    const buffer = createTestImageBuffer()
    const filename = `test-upload-${Date.now()}.jpg`

    const media = await payload.create({
      collection: 'media',
      data: {
        tenant: testTenantId,
        retentionPolicy: 'ephemeral',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      file: {
        data: new Uint8Array(buffer),
        name: filename,
        mimetype: 'image/jpeg',
        size: buffer.length,
      },
      overrideAccess: true,
      context: { allowRetentionPatch: true },
    } as any)

    expect(media.id).toBeDefined()
    expect((media as any).filename).toBeDefined()
    expect((media as any).mimeType).toBe('image/jpeg')

    // Cleanup: delete the media
    await payload.delete({
      collection: 'media',
      id: media.id,
      overrideAccess: true,
    })

    // Verify deleted
    await expect(
      payload.findByID({
        collection: 'media',
        id: media.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('validates allowed MIME types constant includes expected types', () => {
    expect(CHAT_ASSET_ALLOWED_MIME_TYPES).toContain('image/jpeg')
    expect(CHAT_ASSET_ALLOWED_MIME_TYPES).toContain('image/png')
    expect(CHAT_ASSET_ALLOWED_MIME_TYPES).toContain('image/webp')
    expect(CHAT_ASSET_ALLOWED_MIME_TYPES).toContain('application/pdf')
  })

  it('validates max file size constant is reasonable', () => {
    expect(CHAT_ASSET_MAX_BYTES).toBeGreaterThan(0)
    expect(CHAT_ASSET_MAX_BYTES).toBeLessThanOrEqual(50 * 1024 * 1024) // No more than 50MB
  })
})

describe('End-to-end Upload Session Flow', () => {
  it('completes the full session lifecycle: create → upload → finalize → asset', async () => {
    // Step 1: Create upload session (simulates upload-token route)
    const expiresAt = new Date(Date.now() + CHAT_ASSET_TOKEN_VALID_MINUTES * 60 * 1000)
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const initialPathname = buildChatAssetPathname({
      tenantId: testTenantId,
      userId: testUserId,
      uploadSessionId: tempId,
      filename: 'test-lifecycle.pdf',
    })

    const session = await payload.create({
      collection: 'upload-sessions',
      data: {
        tenant: testTenantId,
        createdBy: testUserId,
        purpose: 'chat-media',
        originalFilename: 'test-lifecycle.pdf',
        mimeType: 'application/pdf',
        expectedSize: 4096,
        pathname: initialPathname,
        status: 'initiated',
        expiresAt: expiresAt.toISOString(),
      },
      overrideAccess: true,
    })

    expect(session.status).toBe('initiated')

    // Update pathname with real session ID
    const finalPathname = buildChatAssetPathname({
      tenantId: testTenantId,
      userId: testUserId,
      uploadSessionId: session.id,
      filename: 'test-lifecycle.pdf',
    })

    await payload.update({
      collection: 'upload-sessions',
      id: session.id,
      data: { pathname: finalPathname },
      overrideAccess: true,
    })

    // Step 2: Simulate blob upload completing (set blobUrl)
    const blobUrl = `https://example.blob.vercel-storage.com/${finalPathname}`
    await payload.update({
      collection: 'upload-sessions',
      id: session.id,
      data: { blobUrl, status: 'uploaded' },
      overrideAccess: true,
    })

    // Step 3: Finalize (simulates finalize route)
    const retentionExpiry = new Date(Date.now() + CHAT_ASSET_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const chatAsset = await payload.create({
      collection: 'chat-assets',
      data: {
        tenant: testTenantId,
        createdBy: testUserId,
        url: blobUrl,
        pathname: finalPathname,
        originalFilename: 'test-lifecycle.pdf',
        mimeType: 'application/pdf',
        filesize: 4096,
        retentionPolicy: 'ephemeral',
        expiresAt: retentionExpiry.toISOString(),
        uploadSessionId: session.id,
      },
      overrideAccess: true,
    })

    expect(chatAsset.id).toBeDefined()
    expect(chatAsset.url).toBe(blobUrl)

    // Step 4: Mark session as finalized
    const finalizedSession = await payload.update({
      collection: 'upload-sessions',
      id: session.id,
      data: { status: 'finalized', chatAssetId: chatAsset.id },
      overrideAccess: true,
    })

    expect(finalizedSession.status).toBe('finalized')

    // Verify: session is linked to chat asset
    const fetchedSession = await payload.findByID({
      collection: 'upload-sessions',
      id: session.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(fetchedSession.chatAssetId).toBe(chatAsset.id)

    // Verify: chat asset has correct data
    const fetchedAsset = await payload.findByID({
      collection: 'chat-assets',
      id: chatAsset.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(fetchedAsset.originalFilename).toBe('test-lifecycle.pdf')
    expect(fetchedAsset.uploadSessionId).toBe(session.id)
  })
})

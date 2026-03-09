/**
 * Integration tests for cron cleanup routes
 *
 * Tests:
 * - POST /api/cron/upload-session-cleanup
 * - POST /api/cron/chat-asset-expiry
 * - POST /api/cron/guest-sessions-cleanup
 *
 * Each cron route uses withCronMiddleware which requires
 * Bearer CRON_SECRET for authentication.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST as uploadSessionCleanupPOST } from '@/app/api/cron/upload-session-cleanup/route'
import { POST as chatAssetExpiryPOST } from '@/app/api/cron/chat-asset-expiry/route'
import { POST as guestSessionsCleanupPOST } from '@/app/api/cron/guest-sessions-cleanup/route'
import { createGuestSession } from '../factories/guest-session.factory'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL
const CRON_SECRET = 'test-cron-secret-for-int-tests'

let payload: Payload
let createdUploadSessionIds: string[] = []
let createdChatAssetIds: string[] = []
let createdGuestSessionIds: string[] = []

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  // Set CRON_SECRET for the middleware to read
  process.env.CRON_SECRET = CRON_SECRET

  payload = await getPayload({ config })
})

beforeEach(() => {
  createdUploadSessionIds = []
  createdChatAssetIds = []
  createdGuestSessionIds = []
})

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  // Clean up any remaining test data
  for (const id of createdUploadSessionIds) {
    try {
      await payload.delete({
        collection: 'upload-sessions',
        id,
        overrideAccess: true,
      })
    } catch {
      /* already deleted by cleanup */
    }
  }
  for (const id of createdChatAssetIds) {
    try {
      await payload.delete({
        collection: 'chat-assets',
        id,
        overrideAccess: true,
      })
    } catch {
      /* already deleted by cleanup */
    }
  }
  for (const id of createdGuestSessionIds) {
    try {
      await payload.delete({
        collection: 'guest-sessions',
        id,
        overrideAccess: true,
      })
    } catch {
      /* already deleted by cleanup */
    }
  }

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
})

describe.skipIf(!hasDatabaseUrl)('POST /api/cron/upload-session-cleanup', () => {
  it('returns 401 without CRON_SECRET', async () => {
    const request = new Request('http://localhost:3000/api/cron/upload-session-cleanup', {
      method: 'POST',
    })
    const response = await uploadSessionCleanupPOST(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const request = new Request('http://localhost:3000/api/cron/upload-session-cleanup', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
    })
    const response = await uploadSessionCleanupPOST(request)

    expect(response.status).toBe(401)
  })

  it('runs successfully with no expired sessions', async () => {
    const request = new Request('http://localhost:3000/api/cron/upload-session-cleanup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })
    const response = await uploadSessionCleanupPOST(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.deletedSessions).toBeDefined()
    expect(typeof data.deletedSessions).toBe('number')
  })

  it('deletes expired upload sessions', async () => {
    // Create an expired upload session
    const expiredSession = await payload.create({
      collection: 'upload-sessions',
      data: {
        purpose: 'chat-media',
        originalFilename: 'test-expired.png',
        mimeType: 'image/png',
        pathname: `test/expired-${Date.now()}.png`,
        status: 'initiated',
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      } as any,
      overrideAccess: true,
    })
    createdUploadSessionIds.push(expiredSession.id)

    const request = new Request('http://localhost:3000/api/cron/upload-session-cleanup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })
    const response = await uploadSessionCleanupPOST(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.deletedSessions).toBeGreaterThanOrEqual(1)

    // Verify session was deleted
    const remaining = await payload.find({
      collection: 'upload-sessions',
      where: { id: { equals: expiredSession.id } },
      overrideAccess: true,
    })
    expect(remaining.docs.length).toBe(0)
  })

  it('does not delete non-expired upload sessions', async () => {
    // Create a non-expired session
    const activeSession = await payload.create({
      collection: 'upload-sessions',
      data: {
        purpose: 'chat-media',
        originalFilename: 'test-active.png',
        mimeType: 'image/png',
        pathname: `test/active-${Date.now()}.png`,
        status: 'initiated',
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      } as any,
      overrideAccess: true,
    })
    createdUploadSessionIds.push(activeSession.id)

    const request = new Request('http://localhost:3000/api/cron/upload-session-cleanup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })
    await uploadSessionCleanupPOST(request)

    // Verify session still exists
    const remaining = await payload.find({
      collection: 'upload-sessions',
      where: { id: { equals: activeSession.id } },
      overrideAccess: true,
    })
    expect(remaining.docs.length).toBe(1)
  })
})

describe.skipIf(!hasDatabaseUrl)('POST /api/cron/chat-asset-expiry', () => {
  it('returns 401 without CRON_SECRET', async () => {
    const request = new Request('http://localhost:3000/api/cron/chat-asset-expiry', {
      method: 'POST',
    })
    const response = await chatAssetExpiryPOST(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('runs successfully with no expired assets', async () => {
    const request = new Request('http://localhost:3000/api/cron/chat-asset-expiry', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })
    const response = await chatAssetExpiryPOST(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.deletedAssets).toBeDefined()
    expect(typeof data.deletedAssets).toBe('number')
  })

  it('deletes expired ephemeral chat assets', async () => {
    // Create an expired ephemeral chat asset
    const expiredAsset = await payload.create({
      collection: 'chat-assets',
      data: {
        url: `https://blob.vercel-storage.com/test/expired-${Date.now()}.png`,
        pathname: `test/expired-${Date.now()}.png`,
        originalFilename: 'test-expired.png',
        mimeType: 'image/png',
        filesize: 1024,
        retentionPolicy: 'ephemeral',
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        uploadSessionId: `test-session-${Date.now()}`,
      } as any,
      overrideAccess: true,
    })
    createdChatAssetIds.push(expiredAsset.id)

    const request = new Request('http://localhost:3000/api/cron/chat-asset-expiry', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })
    const response = await chatAssetExpiryPOST(request)

    // May return 200 or 207 (partial success if blob delete fails)
    expect([200, 207]).toContain(response.status)
    const data = await response.json()

    if (response.status === 200) {
      expect(data.success).toBe(true)
      expect(data.deletedAssets).toBeGreaterThanOrEqual(1)
    }

    // Verify asset was deleted from DB regardless of blob status
    const remaining = await payload.find({
      collection: 'chat-assets',
      where: { id: { equals: expiredAsset.id } },
      overrideAccess: true,
    })
    expect(remaining.docs.length).toBe(0)
  })

  it('does not delete persistent chat assets', async () => {
    // Create a persistent asset (even with past expiry)
    const persistentAsset = await payload.create({
      collection: 'chat-assets',
      data: {
        url: `https://blob.vercel-storage.com/test/persistent-${Date.now()}.png`,
        pathname: `test/persistent-${Date.now()}.png`,
        originalFilename: 'test-persistent.png',
        mimeType: 'image/png',
        filesize: 1024,
        retentionPolicy: 'persistent',
        expiresAt: new Date(Date.now() - 3600000).toISOString(),
        uploadSessionId: `test-persistent-session-${Date.now()}`,
      } as any,
      overrideAccess: true,
    })
    createdChatAssetIds.push(persistentAsset.id)

    const request = new Request('http://localhost:3000/api/cron/chat-asset-expiry', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })
    await chatAssetExpiryPOST(request)

    // Persistent asset should still exist
    const remaining = await payload.find({
      collection: 'chat-assets',
      where: { id: { equals: persistentAsset.id } },
      overrideAccess: true,
    })
    expect(remaining.docs.length).toBe(1)
  })
})

describe.skipIf(!hasDatabaseUrl)('POST /api/cron/guest-sessions-cleanup', () => {
  it('returns 401 without CRON_SECRET', async () => {
    const request = new Request('http://localhost:3000/api/cron/guest-sessions-cleanup', {
      method: 'POST',
    })
    const response = await guestSessionsCleanupPOST(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('runs successfully with no sessions to clean', async () => {
    const request = new Request('http://localhost:3000/api/cron/guest-sessions-cleanup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })
    const response = await guestSessionsCleanupPOST(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data).toHaveProperty('expiredSessionsDeleted')
    expect(data).toHaveProperty('claimedSessionsDeleted')
    expect(data).toHaveProperty('orphanedConversationsDeleted')
  })

  it('cleans up revoked guest sessions', async () => {
    // Create a revoked guest session
    const { session } = await createGuestSession(payload, {
      status: 'revoked',
    })
    createdGuestSessionIds.push(session.id)

    const request = new Request('http://localhost:3000/api/cron/guest-sessions-cleanup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })
    const response = await guestSessionsCleanupPOST(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.claimedSessionsDeleted).toBeGreaterThanOrEqual(1)

    // Verify session was deleted
    const remaining = await payload.find({
      collection: 'guest-sessions',
      where: { id: { equals: session.id } },
      overrideAccess: true,
    })
    expect(remaining.docs.length).toBe(0)
  })

  it('cleans up hard-expired guest sessions', async () => {
    // Create a guest session with hardExpiresAt far in the past
    // The cleanup finds sessions where hardExpiresAt < (now - hard_cap_days)
    // Default hard_cap_days=30, so set hardExpiresAt to 60+ days ago
    const longAgo = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000)
    const { session } = await createGuestSession(payload, {
      status: 'active',
      hardExpiresAt: longAgo,
      expiresAt: longAgo,
    })
    createdGuestSessionIds.push(session.id)

    const request = new Request('http://localhost:3000/api/cron/guest-sessions-cleanup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })
    const response = await guestSessionsCleanupPOST(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.expiredSessionsDeleted).toBeGreaterThanOrEqual(1)

    // Verify session was deleted
    const remaining = await payload.find({
      collection: 'guest-sessions',
      where: { id: { equals: session.id } },
      overrideAccess: true,
    })
    expect(remaining.docs.length).toBe(0)
  })
})

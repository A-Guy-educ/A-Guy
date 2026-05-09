/**
 * Integration tests for Account Memory API endpoints
 *
 * Tests:
 * - GET /api/account/memory - Returns user's memory items
 * - DELETE /api/account/memory/[id] - Deletes single memory item
 * - DELETE /api/account/memory/clear - Deletes all user's memory items
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET } from '@/app/api/account/memory/route'
import { DELETE as deleteById } from '@/app/api/account/memory/[id]/route'
import { DELETE as clearAll } from '@/app/api/account/memory/clear/route'
import { createTestUser } from '../factories/user.factory'
import { createMemoryItem as createMemoryItemForTest } from '../factories/memory-item.factory'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let authToken: string
let testUserId: string
let otherUserId: string
let otherUserToken: string

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Create test user
  const user = await createTestUser(payload)
  testUserId = user.id

  const loginResult = await payload.login({
    collection: 'users',
    data: { email: user.email, password: 'test123456' },
  })
  authToken = loginResult.token!

  // Create another user
  const otherUser = await createTestUser(payload, { email: `other-user-${Date.now()}@example.com` })
  otherUserId = otherUser.id

  const otherLoginResult = await payload.login({
    collection: 'users',
    data: { email: otherUser.email, password: 'test123456' },
  })
  otherUserToken = otherLoginResult.token!
})

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  // Clean up test memory items
  const testMemories = await payload.find({
    collection: 'memory_items',
    where: { userId: { equals: testUserId } },
    limit: 100,
    overrideAccess: true,
  })
  for (const mem of testMemories.docs) {
    await payload.delete({ collection: 'memory_items', id: mem.id, overrideAccess: true })
  }

  const otherMemories = await payload.find({
    collection: 'memory_items',
    where: { userId: { equals: otherUserId } },
    limit: 100,
    overrideAccess: true,
  })
  for (const mem of otherMemories.docs) {
    await payload.delete({ collection: 'memory_items', id: mem.id, overrideAccess: true })
  }

  // Clean up test users
  for (const userId of [testUserId, otherUserId]) {
    if (userId) {
      await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
    }
  }

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
})

describe.skipIf(!hasDatabaseUrl)('GET /api/account/memory', () => {
  it('returns 401 when not authenticated', async () => {
    const request = new Request('http://localhost:3000/api/account/memory')
    const response = await GET(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns empty items array when user has no memories', async () => {
    const request = new Request('http://localhost:3000/api/account/memory', {
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.items).toBeDefined()
    expect(Array.isArray(data.items)).toBe(true)
    expect(data.total).toBeDefined()
  })

  it('returns only items belonging to the authenticated user', async () => {
    // Create memory for test user
    const ownMemory = await createMemoryItemForTest(payload, {
      userId: testUserId,
      text: 'My memory',
    })

    // Create memory for other user
    await createMemoryItemForTest(payload, { userId: otherUserId, text: 'Other user memory' })

    try {
      const request = new Request('http://localhost:3000/api/account/memory', {
        headers: { Authorization: `JWT ${authToken}` },
      })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      // Should include test user's memory
      const hasOwnMemory = data.items.some((item: any) => item.id === ownMemory.id)
      expect(hasOwnMemory).toBe(true)

      // Should NOT include other user's memory
      const hasOtherMemory = data.items.some((item: any) => item.text === 'Other user memory')
      expect(hasOtherMemory).toBe(false)
    } finally {
      await payload.delete({ collection: 'memory_items', id: ownMemory.id, overrideAccess: true })
    }
  })
})

describe.skipIf(!hasDatabaseUrl)('DELETE /api/account/memory/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    const request = new Request('http://localhost:3000/api/account/memory/some-id', {
      method: 'DELETE',
    })
    const response = await deleteById(request, { params: Promise.resolve({ id: 'some-id' }) })

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 404 when item does not exist', async () => {
    const request = new Request('http://localhost:3000/api/account/memory/nonexistent-id', {
      method: 'DELETE',
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await deleteById(request, {
      params: Promise.resolve({ id: 'nonexistent-id' }),
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Memory item not found')
  })

  it('returns 403 when item belongs to another user', async () => {
    // Create memory for other user
    const otherMemory = await createMemoryItemForTest(payload, {
      userId: otherUserId,
      text: 'Other user memory',
    })

    try {
      const request = new Request(`http://localhost:3000/api/account/memory/${otherMemory.id}`, {
        method: 'DELETE',
        headers: { Authorization: `JWT ${authToken}` },
      })
      const response = await deleteById(request, {
        params: Promise.resolve({ id: otherMemory.id }),
      })

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe('Forbidden')
    } finally {
      await payload.delete({ collection: 'memory_items', id: otherMemory.id, overrideAccess: true })
    }
  })

  it('successfully deletes own memory item and returns 200', async () => {
    // Create memory for test user
    const memory = await createMemoryItemForTest(payload, {
      userId: testUserId,
      text: 'My memory to delete',
    })

    const request = new Request(`http://localhost:3000/api/account/memory/${memory.id}`, {
      method: 'DELETE',
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await deleteById(request, {
      params: Promise.resolve({ id: memory.id }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)

    // Verify item is gone
    const listRequest = new Request('http://localhost:3000/api/account/memory', {
      headers: { Authorization: `JWT ${authToken}` },
    })
    const listResponse = await GET(listRequest)
    const listData = await listResponse.json()

    const hasDeletedMemory = listData.items.some((item: any) => item.id === memory.id)
    expect(hasDeletedMemory).toBe(false)
  })
})

describe.skipIf(!hasDatabaseUrl)('DELETE /api/account/memory/clear', () => {
  it('returns 401 when not authenticated', async () => {
    const request = new Request('http://localhost:3000/api/account/memory/clear', {
      method: 'DELETE',
    })
    const response = await clearAll(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('deletes all of the user items and returns count', async () => {
    // Create multiple memories for test user
    const memory1 = await createMemoryItemForTest(payload, { userId: testUserId, text: 'Memory 1' })
    const memory2 = await createMemoryItemForTest(payload, { userId: testUserId, text: 'Memory 2' })

    // Create memory for other user (should NOT be deleted)
    const otherMemory = await createMemoryItemForTest(payload, {
      userId: otherUserId,
      text: 'Other user memory',
    })

    try {
      const request = new Request('http://localhost:3000/api/account/memory/clear', {
        method: 'DELETE',
        headers: { Authorization: `JWT ${authToken}` },
      })
      const response = await clearAll(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.deletedCount).toBe(2)

      // Verify only other user's memory remains
      const listRequest = new Request('http://localhost:3000/api/account/memory', {
        headers: { Authorization: `JWT ${authToken}` },
      })
      const listResponse = await GET(listRequest)
      const listData = await listResponse.json()

      expect(listData.items.length).toBe(0)
    } finally {
      await payload.delete({ collection: 'memory_items', id: otherMemory.id, overrideAccess: true })
    }
  })

  it('is idempotent on empty set', async () => {
    const request = new Request('http://localhost:3000/api/account/memory/clear', {
      method: 'DELETE',
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await clearAll(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.deletedCount).toBe(0)
  })
})

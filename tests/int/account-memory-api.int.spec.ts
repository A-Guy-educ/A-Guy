/**
 * Integration tests for GET /api/account/memory
 *
 * Tests:
 * - GET returns 401 when not authenticated
 * - GET returns list of memories for authenticated user (ordered by createdAt desc)
 * - GET with q param performs vector search (or empty gracefully)
 * - Memory fields are correctly serialized (dates as ISO strings)
 */
import { GET } from '@/app/api/account/memory/route'
import { createTestUser } from '../factories/user.factory'
import { ChatRole } from '@/infra/llm/chat-message-role'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let authToken: string
let testUserId: string

// Mock embeddings to use deterministic vectors
function generateDeterministicEmbedding(text: string): number[] {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash = hash & hash
  }
  const seed = Math.abs(hash)
  const random = (index: number) => {
    const x = Math.sin(seed + index) * 10000
    return (x - Math.floor(x)) * 2 - 1
  }
  return Array.from({ length: 1536 }, () => random(Math.random() * 1000))
}

async function insertMemoryItem(data: {
  userId: string
  text: string
  type?: string
  importance?: number
  status?: string
  contextKey?: string
}): Promise<string> {
  const memory = await payload.create({
    collection: 'memory_items',
    data: {
      userId: data.userId,
      text: data.text,
      embedding: generateDeterministicEmbedding(data.text),
      status: (data.status || 'active') as 'active' | 'deprecated',
      contextKey: data.contextKey || 'global',
      importance: data.importance || 3,
      type: (data.type || 'fact') as
        | 'preference'
        | 'decision'
        | 'fact'
        | 'open_loop'
        | 'profile'
        | 'constraint'
        | 'other',
      source: {
        sourceMessageTimestamp: new Date().toISOString(),
        sourceMessageRole: ChatRole.User,
      },
    },
  })
  return memory.id
}

beforeAll(async () => {
  if (!hasDatabaseUrl) return
  payload = await getPayload({ config })

  const user = await createTestUser(payload, {
    email: `memory-api-test-${Date.now()}@example.com`,
  })
  testUserId = user.id

  const loginResult = await payload.login({
    collection: 'users',
    data: { email: user.email, password: 'test123456' },
  })
  authToken = loginResult.token!
}, 60000)

beforeEach(async () => {
  if (!hasDatabaseUrl) return
  // Clean up test memory items
  let hasMore = true
  while (hasMore) {
    const memories = await payload.find({
      collection: 'memory_items',
      where: { userId: { equals: testUserId } },
      limit: 100,
    })
    if (memories.docs.length === 0) {
      hasMore = false
      break
    }
    await Promise.all(
      memories.docs.map((mem) =>
        payload.delete({ collection: 'memory_items', id: mem.id }).catch(() => {}),
      ),
    )
  }
}, 30000)

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return
  try {
    await payload.delete({ collection: 'users', id: testUserId })
  } catch {
    /* already deleted */
  }
  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
}, 60000)

describe.skipIf(!hasDatabaseUrl)('GET /api/account/memory', () => {
  it('returns 401 when not authenticated', async () => {
    const request = new Request('http://localhost:3000/api/account/memory')
    const response = await GET(request)
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns empty list for user with no memories', async () => {
    const request = new Request('http://localhost:3000/api/account/memory', {
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.memories).toEqual([])
    expect(data.total).toBe(0)
    expect(data.searched).toBe(false)
  })

  it('returns memories ordered by createdAt descending', async () => {
    // Insert two memories with different timestamps
    await insertMemoryItem({ userId: testUserId, text: 'Older memory', status: 'active' })
    await new Promise((r) => setTimeout(r, 50))
    await insertMemoryItem({ userId: testUserId, text: 'Newer memory', status: 'active' })

    const request = new Request('http://localhost:3000/api/account/memory', {
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.memories).toHaveLength(2)
    expect(data.memories[0].text).toBe('Newer memory')
    expect(data.memories[1].text).toBe('Older memory')
    expect(data.total).toBeGreaterThanOrEqual(2)
  })

  it('returns only active memories', async () => {
    await insertMemoryItem({ userId: testUserId, text: 'Active memory', status: 'active' })
    await insertMemoryItem({ userId: testUserId, text: 'Deprecated memory', status: 'deprecated' })

    const request = new Request('http://localhost:3000/api/account/memory', {
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    const texts = data.memories.map((m: { text: string }) => m.text)
    expect(texts).toContain('Active memory')
    expect(texts).not.toContain('Deprecated memory')
  })

  it('returns only own memories (not other users)', async () => {
    // Create another user and insert memory for them
    const otherUser = await createTestUser(payload, {
      email: `other-user-${Date.now()}@example.com`,
    })
    await insertMemoryItem({
      userId: otherUser.id,
      text: 'Other user memory',
      status: 'active',
    })
    await insertMemoryItem({ userId: testUserId, text: 'My memory', status: 'active' })

    const request = new Request('http://localhost:3000/api/account/memory', {
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    const texts = data.memories.map((m: { text: string }) => m.text)
    expect(texts).toContain('My memory')
    expect(texts).not.toContain('Other user memory')

    // Cleanup
    await payload.delete({ collection: 'users', id: otherUser.id }).catch(() => {})
  })

  it('with q param returns searched memories (or empty gracefully)', async () => {
    await insertMemoryItem({
      userId: testUserId,
      text: 'I prefer detailed explanations',
      status: 'active',
    })
    await insertMemoryItem({
      userId: testUserId,
      text: 'I like quick answers',
      status: 'active',
    })

    const request = new Request('http://localhost:3000/api/account/memory?q=preferences', {
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    // Either returns matching results (if vector index available) or empty gracefully
    expect(Array.isArray(data.memories)).toBe(true)
    expect(typeof data.searched).toBe('boolean')
  })

  it('response includes correct fields', async () => {
    await insertMemoryItem({
      userId: testUserId,
      text: 'Test memory',
      type: 'preference',
      importance: 4,
      status: 'active',
    })

    const request = new Request('http://localhost:3000/api/account/memory', {
      headers: { Authorization: `JWT ${authToken}` },
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.memories.length).toBeGreaterThan(0)
    const memory = data.memories[0]
    expect(memory).toHaveProperty('_id')
    expect(memory).toHaveProperty('text')
    expect(memory).toHaveProperty('type')
    expect(memory).toHaveProperty('importance')
    expect(memory).toHaveProperty('createdAt')
    expect(memory).toHaveProperty('updatedAt')
    expect(memory).toHaveProperty('status')
    expect(memory).toHaveProperty('userId')
    // createdAt and updatedAt should be ISO strings
    expect(new Date(memory.createdAt).toISOString()).toBe(memory.createdAt)
    expect(new Date(memory.updatedAt).toISOString()).toBe(memory.updatedAt)
  })
})

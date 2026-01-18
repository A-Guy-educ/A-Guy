import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { agentResetChat } from '@/endpoints/agent/reset-chat'
import { startMongoContainer, stopMongoContainer } from '@/utilities/test/mongodb-container'
import { createContextHierarchy } from '../factories/context.factory'
import { createConversation } from '../factories/conversation.factory'
import { createTestUser } from '../factories/user.factory'

let payload: Payload
let originalDatabaseUrl: string | undefined
let context: Awaited<ReturnType<typeof createContextHierarchy>>
let testUserId: string
let testUserIdTwo: string

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  const userOne = await createTestUser(payload)
  const userTwo = await createTestUser(payload)
  testUserId = userOne.id
  testUserIdTwo = userTwo.id

  context = await createContextHierarchy(payload)
}, 120000)

beforeEach(async () => {
  if (!payload) return

  const conversations = await payload.find({
    collection: 'conversations',
    where: {
      or: [{ user: { equals: testUserId } }, { user: { equals: testUserIdTwo } }],
    },
    limit: 1000,
    overrideAccess: true,
  })

  for (const conv of conversations.docs) {
    await payload.delete({
      collection: 'conversations',
      id: conv.id,
      overrideAccess: true,
    })
  }
})

afterAll(async () => {
  if (context?.cleanup) {
    await context.cleanup()
  }

  if (payload && testUserId) {
    await payload.delete({ collection: 'users', id: testUserId, overrideAccess: true })
  }
  if (payload && testUserIdTwo) {
    await payload.delete({ collection: 'users', id: testUserIdTwo, overrideAccess: true })
  }

  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
    delete process.env.DATABASE_URL
  }
}, 120000)

describe('agentResetChat endpoint', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = {
      payload,
      json: async () => ({ contextKey: `exercises:${context.exerciseId}` }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentResetChat(req)
    expect(res.status).toBe(401)
  })

  it('archives current conversation and creates a new one', async () => {
    const contextKey = `exercises:${context.exerciseId}`

    const existing = await createConversation(payload, {
      userId: testUserId,
      contextRef: { relationTo: 'exercises', value: context.exerciseId },
    })

    const req = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({ contextKey }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentResetChat(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.contextKey).toBe(contextKey)
    expect(body.conversationId).toBeDefined()
    expect(body.conversationId).not.toBe(existing.id)

    const archived = await payload.findByID({
      collection: 'conversations',
      id: existing.id,
      overrideAccess: true,
    })
    expect(archived.archivedAt).toBeDefined()

    const newConversation = await payload.findByID({
      collection: 'conversations',
      id: body.conversationId,
      overrideAccess: true,
    })
    expect(newConversation.contextKey).toBe(contextKey)
    expect(newConversation.archivedAt).toBeUndefined()
  })

  it('does not archive conversations for other users', async () => {
    const contextKey = `exercises:${context.exerciseId}`

    const otherConversation = await createConversation(payload, {
      userId: testUserIdTwo,
      contextRef: { relationTo: 'exercises', value: context.exerciseId },
    })

    const req = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({ contextKey }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    await agentResetChat(req)

    const other = await payload.findByID({
      collection: 'conversations',
      id: otherConversation.id,
      overrideAccess: true,
    })
    expect(other.archivedAt).toBeUndefined()
  })

  it('returns 400 for invalid contextKey', async () => {
    const req = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({ contextKey: 'invalid' }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentResetChat(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 400 for empty contextKey', async () => {
    const req = {
      payload,
      user: { id: testUserId } as any,
      json: async () => ({ contextKey: '' }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentResetChat(req)
    expect(res.status).toBe(400)
  })
})

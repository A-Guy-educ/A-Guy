/**
 * Integration tests: Conversation archivedAt Protection
 * Covers: beforeChange hook on conversations collection that strips archivedAt
 *
 * P0 — data integrity: any update could accidentally archive a conversation
 * unless the hook correctly requires req.context.allowArchive === true.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { createTestUser } from '../factories/user.factory'
import { createConversation } from '../factories/conversation.factory'
import { createContextHierarchy } from '../factories/context.factory'

let payload: Payload
let originalDatabaseUrl: string | undefined
let userId: string
let context: Awaited<ReturnType<typeof createContextHierarchy>>

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  const user = await createTestUser(payload)
  userId = user.id
  context = await createContextHierarchy(payload)
}, 120_000)

afterAll(async () => {
  if (context?.cleanup) await context.cleanup()
  if (userId) await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

beforeEach(async () => {
  const convs = await payload.find({
    collection: 'conversations',
    where: { user: { equals: userId } },
    limit: 1000,
    overrideAccess: true,
  })
  for (const c of convs.docs)
    await payload.delete({ collection: 'conversations', id: c.id, overrideAccess: true })
})

describe('conversation archivedAt protection hook', () => {
  it('strips archivedAt from a normal update (no allowArchive context)', async () => {
    const conv = await createConversation(payload, {
      userId,
      contextRef: { relationTo: 'exercises', value: context.exerciseId },
    })

    // Attempt to set archivedAt without the context flag
    await payload.update({
      collection: 'conversations',
      id: conv.id,
      data: { archivedAt: new Date().toISOString() } as any,
      overrideAccess: true,
      // NO context.allowArchive
    })

    const updated = await payload.findByID({
      collection: 'conversations',
      id: conv.id,
      overrideAccess: true,
    })
    // Hook must have stripped archivedAt
    expect(updated.archivedAt).toBeUndefined()
  })

  it('allows setting archivedAt when req.context.allowArchive === true', async () => {
    const conv = await createConversation(payload, {
      userId,
      contextRef: { relationTo: 'exercises', value: context.exerciseId },
    })

    const archiveTime = new Date().toISOString()
    await payload.update({
      collection: 'conversations',
      id: conv.id,
      data: { archivedAt: archiveTime } as any,
      overrideAccess: true,
      context: { allowArchive: true },
    })

    const updated = await payload.findByID({
      collection: 'conversations',
      id: conv.id,
      overrideAccess: true,
    })
    expect(updated.archivedAt).toBeDefined()
  })

  it('does not strip unrelated fields during normal update', async () => {
    const conv = await createConversation(payload, {
      userId,
      contextRef: { relationTo: 'exercises', value: context.exerciseId },
    })

    // Update a non-restricted field — no archivedAt in data at all
    await payload.update({
      collection: 'conversations',
      id: conv.id,
      data: { messages: [{ role: 'user', content: 'Hello', hidden: false }] } as any,
      overrideAccess: true,
    })

    const updated = await payload.findByID({
      collection: 'conversations',
      id: conv.id,
      overrideAccess: true,
    })
    expect(updated.messages).toHaveLength(1)
    expect(updated.archivedAt).toBeUndefined()
  })

  it('cannot archive via create without allowArchive context', async () => {
    // Try to create an already-archived conversation without the context flag
    const conv = await payload.create({
      collection: 'conversations',
      data: {
        contextKey: `exercises:${context.exerciseId}`,
        contextRef: { relationTo: 'exercises', value: context.exerciseId },
        user: userId,
        messages: [],
        lastMessageAt: new Date().toISOString(),
        archivedAt: new Date().toISOString(),
      } as any,
      overrideAccess: true,
      // NO context.allowArchive
    })

    const found = await payload.findByID({
      collection: 'conversations',
      id: conv.id,
      overrideAccess: true,
    })
    // archivedAt must be stripped from create as well
    expect(found.archivedAt).toBeUndefined()
  })

  it('archived conversation is excluded from active queries', async () => {
    const conv = await createConversation(payload, {
      userId,
      contextRef: { relationTo: 'exercises', value: context.exerciseId },
    })

    // Archive it properly
    await payload.update({
      collection: 'conversations',
      id: conv.id,
      data: { archivedAt: new Date().toISOString() } as any,
      overrideAccess: true,
      context: { allowArchive: true },
    })

    // Query for active conversations (archivedAt does not exist)
    const active = await payload.find({
      collection: 'conversations',
      where: {
        and: [{ user: { equals: userId } }, { archivedAt: { exists: false } }],
      },
      overrideAccess: true,
    })
    const ids = active.docs.map((c) => c.id)
    expect(ids).not.toContain(conv.id)
  })
})

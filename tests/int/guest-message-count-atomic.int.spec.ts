/**
 * Integration tests: Guest Message Count Atomic Increment
 * Verifies that concurrent requests to checkAndIncrementGuestMessageCount
 * result in exactly N increments (no race condition bypass).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import {
  createGuestSession,
  checkAndIncrementGuestMessageCount,
} from '@/server/services/guest-session'
import { getGuestChatConfig } from '@/server/config/guest-chat-config'
import { ObjectId, type Collection, type Document } from 'mongodb'

let payload: Payload
let originalDatabaseUrl: string | undefined
let maxMessages: number

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Get the actual config value for assertions
  const guestConfig = await getGuestChatConfig()
  maxMessages = guestConfig.max_messages
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
}, 120_000)

function getGuestSessionsCollection(): Collection<Document> | null {
  const db = payload.db as unknown as {
    connection?: { collection?: (name: string) => unknown }
    collections?: Record<string, unknown>
    collection?: (name: string) => unknown
  }

  const collection =
    db.connection?.collection?.('guest-sessions') ||
    db.collections?.['guest-sessions'] ||
    db.collections?.['guestSessions'] ||
    (db.collections as Record<string, unknown>)?.['guest-sessions'] ||
    db.collection?.('guest-sessions') ||
    null

  return (collection as Collection<Document>) ?? null
}

describe('Guest message count atomic increment', () => {
  it('exactly N concurrent requests succeed when limit is N', async () => {
    const { session } = await createGuestSession(payload, {})

    const totalRequests = 20

    const collection = getGuestSessionsCollection()
    expect(collection).not.toBeNull()

    // Update to set initial state
    await collection!.updateOne({ _id: new ObjectId(session.id) }, { $set: { messageCount: 0 } })

    // Fire concurrent requests
    const promises = Array.from({ length: totalRequests }, () =>
      checkAndIncrementGuestMessageCount(payload, session.id),
    )

    const results = await Promise.all(promises)

    const allowed = results.filter((r) => r.allowed)
    const denied = results.filter((r) => !r.allowed)

    // Exactly maxMessages should be allowed
    expect(allowed.length).toBe(maxMessages)
    expect(denied.length).toBe(totalRequests - maxMessages)

    // Verify the session in the database has exactly maxMessages
    const updatedSession = await payload.findByID({
      collection: 'guest-sessions',
      id: session.id,
    })

    expect(updatedSession.messageCount).toBe(maxMessages)
  })

  it('no double-increment with high concurrency', async () => {
    const { session } = await createGuestSession(payload, {})

    const totalRequests = 50

    const collection = getGuestSessionsCollection()
    await collection!.updateOne({ _id: new ObjectId(session.id) }, { $set: { messageCount: 0 } })

    // Fire 50 concurrent requests - should not exceed maxMessages
    const promises = Array.from({ length: totalRequests }, () =>
      checkAndIncrementGuestMessageCount(payload, session.id),
    )

    await Promise.all(promises)

    // Verify final count is exactly maxMessages (atomic ensures no double increment)
    const updatedSession = await payload.findByID({
      collection: 'guest-sessions',
      id: session.id,
    })

    expect(updatedSession.messageCount).toBe(maxMessages)
    expect(updatedSession.messageCount).toBeLessThanOrEqual(maxMessages)
  })

  it('claimed session is blocked without touching atomic path', async () => {
    const { session } = await createGuestSession(payload, {})

    // Transition to claiming state
    await payload.update({
      collection: 'guest-sessions',
      id: session.id,
      data: { status: 'claiming' },
      overrideAccess: true,
    })

    // Fire concurrent requests
    const promises = Array.from({ length: 5 }, () =>
      checkAndIncrementGuestMessageCount(payload, session.id),
    )

    const results = await Promise.all(promises)

    // All should be blocked
    expect(results.every((r) => !r.allowed && r.blocked)).toBe(true)
  })

  it('returns accurate remaining count under concurrent load', async () => {
    const { session } = await createGuestSession(payload, {})

    const collection = getGuestSessionsCollection()
    await collection!.updateOne({ _id: new ObjectId(session.id) }, { $set: { messageCount: 0 } })

    // Fire concurrent requests equal to maxMessages
    const promises = Array.from({ length: maxMessages }, (_, i) =>
      checkAndIncrementGuestMessageCount(payload, session.id),
    )

    const results = await Promise.all(promises)

    // All should succeed with correct remaining values
    const allowed = results.filter((r) => r.allowed)
    expect(allowed.length).toBe(maxMessages)

    // Check that current counts are exactly 1 through maxMessages (in some order)
    const currentCounts = allowed.map((r) => r.current).sort((a, b) => a - b)
    const expectedCounts = Array.from({ length: maxMessages }, (_, i) => i + 1)
    expect(currentCounts).toEqual(expectedCounts)
  })
})

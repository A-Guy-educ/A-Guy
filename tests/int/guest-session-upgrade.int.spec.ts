/**
 * Integration tests: Guest Session Upgrade
 * Covers: claimGuestConversations() service
 *
 * P0 — data loss risk: sequential (non-atomic) ownership transfer.
 * If any update fails mid-loop, conversations are orphaned.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import {
  claimGuestConversations,
  hasPendingGuestConversations,
} from '@/server/services/guest-session-upgrade'
import { createGuestSession } from '../factories/guest-session.factory'
import { createTestUser } from '../factories/user.factory'

let payload: Payload
let originalDatabaseUrl: string | undefined
let sharedLessonId: string

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  // Build the minimal lesson hierarchy required by exercises
  const category = await payload.create({
    collection: 'categories',
    data: {
      title: 'Guest Upgrade Category',
      slug: `guest-upgrade-cat-${Date.now()}`,
      locale: 'he',
    } as any,
    overrideAccess: true,
  })
  const course = await payload.create({
    collection: 'courses',
    data: { courseLabel: 'GU', title: 'Guest Upgrade Course', categories: [category.id] } as any,
    overrideAccess: true,
  })
  const chapter = await payload.create({
    collection: 'chapters',
    data: { course: course.id, title: 'Guest Upgrade Chapter' } as any,
    overrideAccess: true,
  })
  const lesson = await payload.create({
    collection: 'lessons',
    data: { chapter: chapter.id, title: 'Guest Upgrade Lesson' } as any,
    overrideAccess: true,
  })
  sharedLessonId = lesson.id
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

/** Helper: create a guest-owned conversation */
async function createGuestConversation(guestSessionId: string, exerciseId: string) {
  return payload.create({
    collection: 'conversations',
    data: {
      contextKey: `exercises:${exerciseId}`,
      contextRef: { relationTo: 'exercises', value: exerciseId },
      guestSession: guestSessionId,
      messages: [],
      lastMessageAt: new Date().toISOString(),
    } as any,
    overrideAccess: true,
  })
}

/** Helper: create a minimal exercise to satisfy contextRef */
async function createExercise() {
  const exercise = await payload.create({
    collection: 'exercises',
    data: {
      title: 'Test Exercise',
      lesson: sharedLessonId,
      content: {
        blocks: [
          { id: 'block-1', type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
        ],
      },
    } as any,
    overrideAccess: true,
  })
  return exercise.id
}

describe('claimGuestConversations', () => {
  let exerciseId: string
  let userId: string

  beforeAll(async () => {
    exerciseId = await createExercise()
    const user = await createTestUser(payload)
    userId = user.id
  })

  beforeEach(async () => {
    // clean up any conversations left from previous test
    const all = await payload.find({
      collection: 'conversations',
      limit: 1000,
      overrideAccess: true,
    })
    for (const c of all.docs) {
      await payload.delete({ collection: 'conversations', id: c.id, overrideAccess: true })
    }
    // clean up guest sessions
    const gs = await payload.find({
      collection: 'guest-sessions',
      limit: 1000,
      overrideAccess: true,
    })
    for (const s of gs.docs) {
      await payload.delete({ collection: 'guest-sessions', id: s.id, overrideAccess: true })
    }
  })

  it('returns claimed=0 when session token is invalid', async () => {
    const result = await claimGuestConversations(payload, userId, 'invalid-token')
    expect(result.claimed).toBe(0)
  })

  it('returns claimed=0 when session has no conversations', async () => {
    const { token } = await createGuestSession(payload, { status: 'active' })
    const result = await claimGuestConversations(payload, userId, token)
    expect(result.claimed).toBe(0)
  })

  it('transfers conversations to the authenticated user', async () => {
    const { session, token } = await createGuestSession(payload, { status: 'active' })
    const conv1 = await createGuestConversation(session.id, exerciseId)
    const conv2 = await createGuestConversation(session.id, exerciseId)

    const result = await claimGuestConversations(payload, userId, token)
    expect(result.claimed).toBe(2)

    for (const convId of [conv1.id, conv2.id]) {
      const updated = await payload.findByID({
        collection: 'conversations',
        id: convId,
        overrideAccess: true,
        depth: 0,
      })
      expect(updated.user).toBe(userId)
      expect(updated.guestSession).toBeNull()
    }
  })

  it('revokes the guest session after claiming', async () => {
    const { session, token } = await createGuestSession(payload, { status: 'active' })
    await createGuestConversation(session.id, exerciseId)

    await claimGuestConversations(payload, userId, token)

    const revoked = await payload.findByID({
      collection: 'guest-sessions',
      id: session.id,
      overrideAccess: true,
    })
    expect(revoked.status).toBe('revoked')
  })

  it('does not transfer archived conversations', async () => {
    const { session, token } = await createGuestSession(payload, { status: 'active' })

    // Create an archived conversation (archivedAt must be in data + allowArchive context)
    await payload.create({
      collection: 'conversations',
      data: {
        contextKey: `exercises:${exerciseId}`,
        contextRef: { relationTo: 'exercises', value: exerciseId },
        guestSession: session.id,
        messages: [],
        lastMessageAt: new Date().toISOString(),
        archivedAt: new Date().toISOString(),
      } as any,
      overrideAccess: true,
      context: { allowArchive: true },
    })
    // Manually set archivedAt via direct update with allowArchive context
    const archived = await payload.create({
      collection: 'conversations',
      data: {
        contextKey: `exercises:${exerciseId}`,
        contextRef: { relationTo: 'exercises', value: exerciseId },
        guestSession: session.id,
        messages: [],
        lastMessageAt: new Date().toISOString(),
      } as any,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'conversations',
      id: archived.id,
      data: { archivedAt: new Date().toISOString() } as any,
      overrideAccess: true,
      context: { allowArchive: true },
    })

    const result = await claimGuestConversations(payload, userId, token)
    // Only non-archived conversations are claimed
    expect(result.claimed).toBe(0)
  })

  it("does not claim conversations from other users' sessions", async () => {
    const { session: sessionA } = await createGuestSession(payload, { status: 'active' })
    const { token: tokenB } = await createGuestSession(payload, { status: 'active' })

    await createGuestConversation(sessionA.id, exerciseId)

    const result = await claimGuestConversations(payload, userId, tokenB)
    expect(result.claimed).toBe(0)

    // Session A's conversation still belongs to no user
    const convs = await payload.find({
      collection: 'conversations',
      where: { guestSession: { equals: sessionA.id } },
      overrideAccess: true,
    })
    expect(convs.docs[0].user).toBeFalsy()
  })

  it('sets the Clear-Cookie header on successful claim', async () => {
    const { token } = await createGuestSession(payload, { status: 'active' })
    const result = await claimGuestConversations(payload, userId, token)
    const setCookie = result.headers.get('Set-Cookie')
    expect(setCookie).toContain('Max-Age=0')
  })
})

describe('hasPendingGuestConversations', () => {
  let exerciseId: string

  beforeAll(async () => {
    exerciseId = await createExercise()
  })

  beforeEach(async () => {
    const all = await payload.find({
      collection: 'conversations',
      limit: 1000,
      overrideAccess: true,
    })
    for (const c of all.docs)
      await payload.delete({ collection: 'conversations', id: c.id, overrideAccess: true })
    const gs = await payload.find({
      collection: 'guest-sessions',
      limit: 1000,
      overrideAccess: true,
    })
    for (const s of gs.docs)
      await payload.delete({ collection: 'guest-sessions', id: s.id, overrideAccess: true })
  })

  it('returns false for invalid token', async () => {
    expect(await hasPendingGuestConversations(payload, 'no-such-token')).toBe(false)
  })

  it('returns false when session exists but has no conversations', async () => {
    const { token } = await createGuestSession(payload, { status: 'active' })
    expect(await hasPendingGuestConversations(payload, token)).toBe(false)
  })

  it('returns true when session has pending conversations', async () => {
    const { session, token } = await createGuestSession(payload, { status: 'active' })
    await createGuestConversation(session.id, exerciseId)
    expect(await hasPendingGuestConversations(payload, token)).toBe(true)
  })
})
